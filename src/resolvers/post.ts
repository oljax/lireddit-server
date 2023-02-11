import { Updoot } from "../entities/Updoot";
import { Arg, Ctx, Field, FieldResolver, InputType, Int, Mutation, ObjectType, Query, Resolver, Root, UseMiddleware } from "type-graphql";
import AppDataSource from "../db_config";
import { Post } from "../entities/Post";
import { isAuth } from "../middleware/isAuth";
import { MyContext } from "../types";
import { User } from "../entities/User";

// import { MyContext } from "../types";
// import { RequiredEntityData } from "@mikro-orm/core";

@InputType()
class PostInput {
    @Field()
    title: string

    @Field()
    text: string
}

@ObjectType()
class PaginatedPosts {
    @Field(() => [Post])
    posts: Post[]
    @Field()
    hasMore: boolean
}


@Resolver(Post)
export class PostResolvers {
    @FieldResolver(() => String)
    textSnippet(@Root() post: Post) {
    return post.text.slice(0, 50);
    }      

    @FieldResolver(() => User)
    creator(
        @Root() post: Post,
        @Ctx() {userLoader}:MyContext
        ) {
        return userLoader.load(post.creatorId);
    }

    @FieldResolver(() => Int, {nullable: true})
    async voteStatus(
        @Root() post: Post,
        @Ctx() { updootLoader, req}: MyContext
    ) {
        if(!req.session.userId) {
            return null
        }
        const updoot = await updootLoader.load({
            postId: post.id,
            userId: req.session.userId
        });

        return updoot ? updoot.value : null;
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async vote(
        @Arg('postId', () => Int) postId: number,
        @Arg('value', () => Int) value: number,
        @Ctx() {req}: MyContext
    ) {
        const isUpdoot = value !== -1;
        const realValue = isUpdoot ? 1 : -1;
        const {userId} = req.session;

        const updoot = await Updoot.findOne({where: {postId, userId}});

        // the user has voted on the post before
        // and they are changing their vote 
        if (updoot && updoot.value !== realValue) {
            await AppDataSource.transaction(async tm =>{
                await tm.query(`
                    update updoot
                    set value = $1
                    where "postId" = $2 and "userId" = $3
                `, [realValue, postId, userId]);

                await tm.query(`
                 update post 
                 set points = points + $1
                 where id = $2
                 `, [2 * realValue, postId]);
            });
        } else if (!updoot) {
            // has never voted before
            await AppDataSource.transaction(async tm => {
                 await tm.query(`
                insert into updoot ("userId", "postId", value)
                values ($1, $2, $3)
                 `, [userId, postId, realValue]);

                 await tm.query(`
                 update post 
                 set points = points + $1
                 where id = $2
                 `, [realValue, postId]);
            })
        }
        // await Updoot.insert({
        //     userId,
        //     postId,
        //     value: realValue,
        // })

        return true;
    }

    @Query(() => PaginatedPosts)
    // @Ctx() {em}: MyContext
    async posts(
        @Arg('limit', () => Int) limit: number,
        @Arg('cursor', () => String, {nullable: true}) cursor: string | null,
        // @Ctx() {req}: MyContext
    ): Promise<PaginatedPosts> {
        const realLimit = Math.min(50, limit);       
        const realLimitPlusOne = realLimit + 1;

        const replacemets: any[] = [realLimitPlusOne];

        // if (req.session.userId) {
        //     replacemets.push(req.session.userId)
        // }
        
        if (cursor) {
            replacemets.push(new Date(parseInt(cursor)));            
        }

        // json_build_object(
        //     'id', u.id,
        //     'username', u.username,
        //     'email', u.email,
        //     'createdAt', u."createdAt",
        //     'updatedAt', u."updatedAt"
        //     ) creator,

        // inner join public.user u on u.id = p."creatorId"

        // ${
        //     req.session.userId 
        //     ? '(select value from updoot where "userId" = $2 and "postId" = p.id) "voteStatus"' 
        //     : 'null as "voteStatus"'
        // }

        const posts = await AppDataSource.query(`
            select p.*
            from post p            
            ${cursor ? `where p."createdAt" < $2` : ''}
            order by p."createdAt" DESC
            limit $1
        `, 
            replacemets
        );        

        // const qb = AppDataSource
        // .getRepository(Post)
        // .createQueryBuilder("p") 
        // .innerJoinAndSelect("p.creator", "u", 'u.id = p."creatorId"')
        // .orderBy('p."createdAt"', "DESC")
        // .take(realLimitPlusOne);
        
        // if (cursor) {
        //     qb.where('p."createdAt" < :cursor', {
        //         cursor: new Date(parseInt(cursor)),
        //     });
        // }

        // const posts = await qb.getMany();
        // console.log('post: ', posts);
        return {
            posts: posts.slice(0, realLimit),
            hasMore: posts.length === realLimitPlusOne,
        };
            
    }

    // , relations: ["creator"]
    @Query(() => Post, {nullable: true})
    post(        
        @Arg("id", () => Int) id: number        
        ): Promise<Post | null> {
            
            return Post.findOne({where: {id}});
    }

    @Mutation(() => Post)
    @UseMiddleware(isAuth)
    async createPost(
        @Arg("input") input: PostInput,
        @Ctx() {req}: MyContext
    ): Promise<Post> {        
        return Post.create({
            ...input,
            creatorId: req.session.userId,
        }).save();
    }

    @Mutation(() => Post, {nullable: true})
    @UseMiddleware(isAuth)
    async updatePost(
        @Arg("id", () => Int) id: number,
        @Arg("title") title: string,        
        @Arg("text") text: string,        
        @Ctx() {req}: MyContext,
    ): Promise<Post | null> {        
        const result = await AppDataSource
        .createQueryBuilder()
        .update(Post)
        .set({title, text})
        .where('id = :id and "creatorId" = creatorId', { 
            id, 
            cretorId: req.session.userId
        })
        .returning("*")
        .execute()
        
        return result.raw[0] as any;
    }

    @Mutation(() => Boolean)
    @UseMiddleware(isAuth)
    async deletePost(
        @Arg("id", () => Int) id: number,
        @Ctx() {req}: MyContext
    ): Promise<boolean> {    
        await Post.delete({ id, creatorId: req.session.userId });
        return true;
    }
}