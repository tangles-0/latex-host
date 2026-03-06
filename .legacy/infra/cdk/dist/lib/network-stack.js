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
exports.NetworkStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
class NetworkStack extends cdk.Stack {
    vpc;
    cluster;
    albSecurityGroup;
    appSecurityGroup;
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefix = `${props.config.appName}-${props.config.environment}`;
        this.vpc = new ec2.Vpc(this, "Vpc", {
            vpcName: `${prefix}-vpc`,
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                { name: "public", subnetType: ec2.SubnetType.PUBLIC },
                { name: "private-egress", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
                { name: "private-isolated", subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
            ],
        });
        this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: "ALB security group",
            securityGroupName: `${prefix}-alb-sg`,
        });
        this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80));
        this.albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
        this.appSecurityGroup = new ec2.SecurityGroup(this, "AppSecurityGroup", {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: "ECS app task security group",
            securityGroupName: `${prefix}-app-sg`,
        });
        this.appSecurityGroup.addIngressRule(this.albSecurityGroup, ec2.Port.tcp(3000));
        this.cluster = new ecs.Cluster(this, "Cluster", {
            vpc: this.vpc,
            clusterName: `${prefix}-cluster`,
            containerInsightsV2: ecs.ContainerInsights.ENABLED,
        });
    }
}
exports.NetworkStack = NetworkStack;
