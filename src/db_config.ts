
import {DataSource} from "typeorm";

import {getConfig} from "./datasource.config";



const AppDataSource = new DataSource(getConfig());

export default AppDataSource;