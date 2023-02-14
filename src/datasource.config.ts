import {DataSourceOptions} from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import { Updoot } from "./entities/Updoot";
// import Post from "./entities/Post"
import path from "path";


export function getConfig() {
    require('dotenv-safe').config();
    return {
        type: "postgres",
        url: process.env.DATABASE_URL,
        logging: true,
        // synchronize: true,
        migrations: [path.join(__dirname, "./migrations/*")],    
        entities: [Post, User, Updoot]
    } as DataSourceOptions;    
}
