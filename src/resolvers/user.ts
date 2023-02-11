import { User } from "../entities/User";
import { MyContext } from "../types";
import { Arg, Ctx, Field, FieldResolver, Mutation, ObjectType, Query, Resolver, Root } from "type-graphql";
// import { RequiredEntityData } from "@mikro-orm/core";
import argon2 from "argon2";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UserPasswordInput } from "./UserPasswordInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import {v4} from "uuid";
import AppDataSource from "../db_config";





@ObjectType()
class FieldError {
    @Field()
    field: string

    @Field()
    message: string
}

@ObjectType()
class UserResponse {
    @Field(() => [FieldError], {nullable: true})
    errors?: FieldError[];

    @Field(() => User, {nullable: true})
    user?: User;
}

@Resolver(User)
export class UserResolvers {

    @FieldResolver(() => String)
    email(@Root() user: User, @Ctx() {req}: MyContext) {
        // this case when user can see own email
        if(req.session.userId === user.id) {
            return user.email;
        }

        // current user wants to see someone elses email
        return "";
    }

    @Mutation(() => UserResponse)
    async changePassword(
        @Arg("token") token: string,
        @Arg("newPassword") newPassword: string,
        @Ctx() {redis, req }: MyContext
    ): Promise<UserResponse> {
        if(newPassword.length <= 2) {
            return {
                errors: [
                    {
                        field: "newPassword",
                        message: "Password length must be greater that 2",
                    }
                ]
            }
        }
        const key = FORGET_PASSWORD_PREFIX + token;
        const userId = await redis.get(key);
        
        
        if(!userId) {
            return {
                errors: [
                    {
                        field: "token",
                        message: "token expired",
                    }
                ]
            }
        }

        // const emFork = em.fork();
        // const user = await emFork.findOne(User, {id: parseInt(userId)});
        const userIdNum = parseInt(userId);
        const user = await User.findOne({where: {id: userIdNum}});
        if(!user) {
            return {
                errors: [
                    {
                        field: "token",
                        message: "user nolonger exists",
                    }
                ]
            }
        }

        // user.password = await argon2.hash(newPassword);
        // await emFork.persistAndFlush(user);
        await User.update(
            {id: userIdNum},
            {
                password: await argon2.hash(newPassword)
            }
        );
        await redis.del(key);
        req.session.userId = user.id;
        return { user };
    }

    @Mutation(() => Boolean)
    async forgotPassword(
        @Arg("email") email: string,
        @Ctx() {redis} : MyContext
    ) {
    //    const emFork = em.fork();
    //    const user = await emFork.findOne(User, {email});
        
        const user = await User.findOne({where: {email}});
       
       if(!user) {
        return true;
       }
       const token = v4();

       
       const key = FORGET_PASSWORD_PREFIX + token;
        await redis.set(
        key,
        user.id,
        "EX",
        1000 * 60 * 60 * 24 * 3
      ); // 3 days
  
      await sendEmail(
        email,
        `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
      );

        

       return true;
    }

    @Query(() => User, {nullable: true})
    async me(@Ctx() {req}: MyContext){
        if(!req.session.userId) {
            return null;
        }

        // const emFork = em.fork();
        // const user = await emFork.findOne(User, {id: req.session.userId});
        const userId = req.session.userId;
        const user = await User.findOne({where: {id: userId}});
        return user;
    }
    @Mutation(() => UserResponse)
    async register(
        @Arg('options') options: UserPasswordInput,
        @Ctx() {req}: MyContext
    ): Promise<UserResponse> {

        const errors = validateRegister(options);
        if(errors) {
            return {errors};
        }
        

        const hashPassword = await argon2.hash(options.password);
        // const emFork = em.fork();
        // const user = emFork.create(User, {
        //     username: options.username,
        //     email: options.email,
        //     password: hashPassword,
        // } as RequiredEntityData<User>);
        let user;
        try {
            // await emFork.persistAndFlush(user);    
            const result = await AppDataSource.getRepository(User)
            .createQueryBuilder()
            .insert()
            .into(User)
            .values({
                username: options.username,
                email: options.email,
                password: hashPassword,
            })
            .returning("*")
            .execute();
            // console.log("result is:", result);
            user = result.raw[0];
        } catch (error) {
            console.log("typeorm error:", error);
            // error.detail.includes("already exists")
            if (error.code === "23505") {
                return {
                    errors: [
                        {
                            field: "username",
                            message: "username already taken",
                        },
                    ],
                };
            }
        }

        req.session.userId = user.id;

        return {user};
    }

    @Mutation(() => UserResponse)
    async login(
        @Arg("usernameOrEmail") usernameOrEmail: string,
        @Arg("password") password: string,
        @Ctx() { req }: MyContext
    ): Promise<UserResponse> {
        // const emFork = em.fork();
        const user = await User.findOne( 
            usernameOrEmail.includes("@")
            ? {where: {email: usernameOrEmail}}
            : {where: {username: usernameOrEmail}}
            );
        if(!user) {
            return {
                errors: [
                    {
                        field: "usernameOrEmail",
                        message: "that user doesn't exist",
                    },
                ],
            };
        }
        const valid = await argon2.verify(user.password, password);
        if(!valid) {
            return {
                errors: [
                    {
                        field: "password",
                        message: "incorrect password",
                    },
                ],
            };
        }

        req.session.userId = user.id
        
        return {user};
    }

    @Mutation(() => Boolean)
    logout(@Ctx() { req, res }: MyContext) {
        return new Promise((resolve) =>
          req.session.destroy((err) => {
            res.clearCookie(COOKIE_NAME);
            if (err) {
              console.log(err);
              resolve(false);
              return;
            }
            
            resolve(true);
          })
        );
    }
}