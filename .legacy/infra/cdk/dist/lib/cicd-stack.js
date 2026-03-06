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
exports.CiCdStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class CiCdStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const provider = new iam.OpenIdConnectProvider(this, "GithubOidcProvider", {
            url: "https://token.actions.githubusercontent.com",
            clientIds: ["sts.amazonaws.com"],
        });
        const appRoleResourcePattern = `arn:aws:iam::${this.account}:role/${props.config.appName}-*`;
        const cdkBootstrapRolePattern = `arn:aws:iam::${this.account}:role/cdk-hnb659fds-*`;
        const basePolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        "cloudformation:*",
                        "ec2:*",
                        "ecs:*",
                        "ecr:*",
                        "elasticloadbalancing:*",
                        "logs:*",
                        "dynamodb:*",
                        "rds:*",
                        "secretsmanager:*",
                        "kms:*",
                        "s3:*",
                        "ssm:*",
                        "sts:GetCallerIdentity",
                    ],
                    resources: ["*"],
                }),
                new iam.PolicyStatement({
                    actions: [
                        "iam:PassRole",
                        "iam:GetRole",
                        "iam:CreateRole",
                        "iam:AttachRolePolicy",
                        "iam:PutRolePolicy",
                        "iam:DeleteRolePolicy",
                        "iam:DetachRolePolicy",
                        "iam:TagRole",
                        "iam:UntagRole",
                    ],
                    resources: [appRoleResourcePattern, cdkBootstrapRolePattern],
                }),
            ],
        });
        this.createRole("DevDeployRole", {
            provider,
            policy: basePolicy,
            githubSub: `repo:${props.githubOrg}/${props.githubRepo}:ref:refs/heads/main`,
            roleName: `${props.config.appName}-github-deploy-dev`,
        });
        this.createRole("ProdDeployRole", {
            provider,
            policy: basePolicy,
            githubSub: `repo:${props.githubOrg}/${props.githubRepo}:ref:refs/tags/*`,
            roleName: `${props.config.appName}-github-deploy-prod`,
        });
    }
    createRole(id, input) {
        return new iam.Role(this, id, {
            roleName: input.roleName,
            assumedBy: new iam.WebIdentityPrincipal(input.provider.openIdConnectProviderArn, {
                StringEquals: {
                    "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
                },
                StringLike: {
                    "token.actions.githubusercontent.com:sub": input.githubSub,
                },
            }),
            inlinePolicies: {
                DeployPolicy: input.policy,
            },
        });
    }
}
exports.CiCdStack = CiCdStack;
