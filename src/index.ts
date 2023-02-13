import "reflect-metadata";
// import {MikroORM} from "@mikro-orm/core";
import { COOKIE_NAME, __prod__ } from "./constants";
// import mikroConfig from "./mikro-orm.config";
import express from "express";
import {ApolloServer} from "apollo-server-express";
import {buildSchema} from "type-graphql";
import { HelloResolvers } from "./resolvers/hello";
import { PostResolvers } from "./resolvers/post";
import { UserResolvers } from "./resolvers/user";
import { MyContext } from "./types";
import cors from "cors";
import Redis from "ioredis";
import  AppDataSource  from "./db_config"
import { createUserLoader } from "./utils/createUserLoader";
import { createUpdootLoader } from "./utils/createUpdootLoader"; 

const main = async () => {       
  AppDataSource.initialize()
    .then(() => {
      console.log("Data Source has been initialized!")
    })
    .catch((err) => {
      console.error("Error during Data Source initialization", err)
    });  
    const app = express();  
    const session = require("express-session");
    let RedisStore = require("connect-redis")(session);
    let redis = new Redis(process.env.REDIS_URL);

    app.set("trust proxy", 1);

    app.use(
      cors({
        origin: process.env.CORS_ORIGIN,
        credentials: true,
      })
    );

    app.use(
        session({
          name: COOKIE_NAME,
          store: new RedisStore({
            client: redis,
            disableTouch: true,
          }),
          cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
            httpOnly: true,
            sameSite: "lax", // csrf
            secure: __prod__, // cookie only works in https
            domain: __prod__ ? ".onrender.com" : undefined,
          },
          saveUninitialized: false,
          secret: process.env.SESSION_SECRET,
          resave: false,
        })
      );
    
    const apolloServer = new ApolloServer({
        schema: await buildSchema({
            resolvers: [HelloResolvers, PostResolvers, UserResolvers],
            validate: false
        }),
        context: ({req, res}): MyContext => <MyContext>({
          req, 
          res, 
          redis,
          userLoader: createUserLoader(),
          updootLoader: createUpdootLoader(),
        })
    });
    // em: orm.em, 

    apolloServer.applyMiddleware({ app, cors: false });
    
    app.listen(parseInt(process.env.PORT), () => {
        console.log('server started on localhost: 4000')
    })
   

};

main().catch((err) => {
    console.log(err);
})



