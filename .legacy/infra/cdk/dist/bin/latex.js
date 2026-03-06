#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const config_1 = require("../lib/config");
const network_stack_1 = require("../lib/network-stack");
const data_stack_1 = require("../lib/data-stack");
const app_stack_1 = require("../lib/app-stack");
const observability_stack_1 = require("../lib/observability-stack");
const cicd_stack_1 = require("../lib/cicd-stack");
const app = new cdk.App();
const envName = app.node.tryGetContext("env") ?? "dev";
const imageTag = app.node.tryGetContext("imageTag") ?? "latest";
const desiredCountFromContext = app.node.tryGetContext("desiredCount");
const certificateArnFromContext = app.node.tryGetContext("certificateArn");
const certificateArnFromLegacyContext = app.node.tryGetContext("certArn");
const certificateArnFromEnv = process.env.CERT_ARN ??
    process.env.CERTIFICATE_ARN ??
    process.env.ACM_CERTIFICATE_ARN ??
    process.env.CDK_CERTIFICATE_ARN;
const certificateArn = (certificateArnFromContext ??
    certificateArnFromLegacyContext ??
    certificateArnFromEnv ??
    "").trim();
const config = (0, config_1.getEnvironmentConfig)(envName);
const desiredCountOverride = desiredCountFromContext === undefined ? undefined : Number.parseInt(String(desiredCountFromContext), 10);
if (desiredCountOverride !== undefined && (!Number.isFinite(desiredCountOverride) || desiredCountOverride < 0)) {
    throw new Error("Invalid desiredCount context. Use a non-negative integer, e.g. -c desiredCount=0");
}
if (!certificateArn) {
    throw new Error([
        "Missing certificate ARN.",
        "Provide one of:",
        "- CDK context: -c certificateArn=arn:aws:acm:REGION:ACCOUNT:certificate/ID",
        "- Env var: CERT_ARN=arn:aws:acm:REGION:ACCOUNT:certificate/ID",
        "",
        "Note: older deployments may have used the legacy context key 'certArn'.",
    ].join("\n"));
}
if (!certificateArnFromContext && certificateArnFromLegacyContext) {
    // eslint-disable-next-line no-console
    console.warn("Warning: using legacy CDK context key 'certArn'. Please migrate to '-c certificateArn=...'.");
}
console.log("Using container image: ", imageTag);
const stackEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: config.region,
};
const stackPrefix = `${config.appName}-${config.environment}`;
const network = new network_stack_1.NetworkStack(app, `${stackPrefix}-network`, {
    env: stackEnv,
    config,
});
const data = new data_stack_1.DataStack(app, `${stackPrefix}-data`, {
    env: stackEnv,
    config,
    vpc: network.vpc,
    appSecurityGroup: network.appSecurityGroup,
});
const application = new app_stack_1.AppStack(app, `${stackPrefix}-app`, {
    env: stackEnv,
    config,
    vpc: network.vpc,
    cluster: network.cluster,
    albSecurityGroup: network.albSecurityGroup,
    appSecurityGroup: network.appSecurityGroup,
    imageBucket: data.imageBucket,
    dbInstance: data.dbInstance,
    dbCredentialsSecret: data.dbCredentialsSecret,
    appSecret: data.appSecret,
    rateLimitTable: data.rateLimitTable,
    imageTag,
    certificateArn,
    desiredCountOverride,
});
application.addDependency(network);
application.addDependency(data);
new observability_stack_1.ObservabilityStack(app, `${stackPrefix}-observability`, {
    env: stackEnv,
    config,
    service: application.service,
    loadBalancer: application.loadBalancer,
    targetGroup: application.targetGroup,
});
if (config.environment === "dev") {
    new cicd_stack_1.CiCdStack(app, `${config.appName}-cicd`, {
        env: stackEnv,
        config,
        githubOrg: "tangles-0",
        githubRepo: "latex",
    });
}
