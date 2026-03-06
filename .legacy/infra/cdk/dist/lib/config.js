"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvironmentConfig = getEnvironmentConfig;
const BASE = {
    appName: "latex",
    region: "ap-southeast-2",
};
const CONFIG_BY_ENV = {
    dev: {
        ...BASE,
        appDomain: "dev.pics.latex.gg",
        cpu: 512,
        memoryMiB: 1024,
        desiredCount: 2,
        minTasks: 2,
        maxTasks: 4,
        dbAllocatedStorageGiB: 20,
        dbInstanceType: "t4g.medium",
        dbMultiAz: true,
        dbBackupRetentionDays: 7,
    },
    prod: {
        ...BASE,
        appDomain: "pre-prod.pics.latex.gg",
        cpu: 1024,
        memoryMiB: 2048,
        desiredCount: 2,
        minTasks: 2,
        maxTasks: 8,
        dbAllocatedStorageGiB: 50,
        dbInstanceType: "t4g.large",
        dbMultiAz: true,
        dbBackupRetentionDays: 14,
    },
};
function getEnvironmentConfig(input) {
    if (input !== "dev" && input !== "prod") {
        throw new Error(`Unsupported env '${input}'. Use -c env=dev or -c env=prod.`);
    }
    return {
        environment: input,
        ...CONFIG_BY_ENV[input],
    };
}
