"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const datasource_config_1 = require("./datasource.config");
const AppDataSource = new typeorm_1.DataSource((0, datasource_config_1.getConfig)());
exports.default = AppDataSource;
//# sourceMappingURL=db_config.js.map