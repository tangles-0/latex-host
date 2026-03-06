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
exports.AppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
class AppStack extends cdk.Stack {
    service;
    loadBalancer;
    targetGroup;
    ecrRepository;
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefix = `${props.config.appName}-${props.config.environment}`;
        this.ecrRepository = ecr.Repository.fromRepositoryName(this, "AppRepository", `${prefix}-app`);
        const taskRole = new iam.Role(this, "TaskRole", {
            assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            description: "Runtime role for latex ECS tasks",
        });
        props.imageBucket.grantReadWrite(taskRole);
        props.appSecret.grantRead(taskRole);
        props.dbCredentialsSecret.grantRead(taskRole);
        props.rateLimitTable.grantReadWriteData(taskRole);
        const taskDef = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
            cpu: props.config.cpu,
            memoryLimitMiB: props.config.memoryMiB,
            taskRole,
            family: `${prefix}-task`,
        });
        const container = taskDef.addContainer("LatexContainer", {
            image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, props.imageTag),
            logging: ecs.LogDrivers.awsLogs({ streamPrefix: `${prefix}-app` }),
            environment: {
                NODE_ENV: "production",
                PORT: "3000",
                HOSTNAME: "0.0.0.0",
                STORAGE_BACKEND: "s3",
                S3_BUCKET: props.imageBucket.bucketName,
                S3_REGION: this.region,
                NEXTAUTH_URL: `https://${props.config.appDomain}`,
                PGHOST: props.dbInstance.dbInstanceEndpointAddress,
                PGPORT: props.dbInstance.dbInstanceEndpointPort,
                PGDATABASE: "latex",
                PGSSLMODE: "require",
                RATE_LIMIT_BACKEND: "dynamodb",
                RATE_LIMIT_TABLE: props.rateLimitTable.tableName,
                RATE_LIMIT_WINDOW_MS: "300000",
                RATE_LIMIT_MAX_ATTEMPTS: "20",
            },
            secrets: {
                NEXTAUTH_SECRET: ecs.Secret.fromSecretsManager(props.appSecret, "NEXTAUTH_SECRET"),
                ADMIN_BOOTSTRAP_TOKEN: ecs.Secret.fromSecretsManager(props.appSecret, "ADMIN_BOOTSTRAP_TOKEN"),
                PGUSER: ecs.Secret.fromSecretsManager(props.dbCredentialsSecret, "username"),
                PGPASSWORD: ecs.Secret.fromSecretsManager(props.dbCredentialsSecret, "password"),
            },
            readonlyRootFilesystem: true,
        });
        container.addPortMappings({
            containerPort: 3000,
            protocol: ecs.Protocol.TCP,
        });
        this.service = new ecs.FargateService(this, "Service", {
            cluster: props.cluster,
            taskDefinition: taskDef,
            serviceName: `${prefix}-svc`,
            desiredCount: props.desiredCountOverride ?? props.config.desiredCount,
            securityGroups: [props.appSecurityGroup],
            assignPublicIp: false,
            vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
            circuitBreaker: { rollback: true },
            healthCheckGracePeriod: cdk.Duration.seconds(90),
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
        });
        this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "Alb", {
            vpc: props.vpc,
            internetFacing: true,
            securityGroup: props.albSecurityGroup,
            loadBalancerName: `${prefix}-alb`,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            dropInvalidHeaderFields: true,
            deletionProtection: props.config.environment === "prod",
            desyncMitigationMode: elbv2.DesyncMitigationMode.STRICTEST,
        });
        this.loadBalancer.setAttribute("routing.http.desync_mitigation_mode", "strictest");
        this.loadBalancer.setAttribute("routing.http.x_amzn_tls_version_and_cipher_suite.enabled", "true");
        const certificate = acm.Certificate.fromCertificateArn(this, "HttpsCertificate", props.certificateArn);
        const httpsListener = this.loadBalancer.addListener("HttpsListener", {
            port: 443,
            open: true,
            certificates: [certificate],
        });
        this.targetGroup = new elbv2.ApplicationTargetGroup(this, "TargetGroup", {
            vpc: props.vpc,
            targetType: elbv2.TargetType.IP,
            port: 3000,
            protocol: elbv2.ApplicationProtocol.HTTP,
            healthCheck: {
                path: "/api/health",
                healthyHttpCodes: "200",
                interval: cdk.Duration.seconds(30),
            },
        });
        this.targetGroup.addTarget(this.service);
        httpsListener.addTargetGroups("AppTargetGroupHttps", {
            targetGroups: [this.targetGroup],
        });
        this.loadBalancer.addListener("HttpListener", {
            port: 80,
            open: true,
            defaultAction: elbv2.ListenerAction.redirect({
                protocol: "HTTPS",
                port: "443",
                permanent: true,
            }),
        });
        const scalableTarget = this.service.autoScaleTaskCount({
            minCapacity: props.config.minTasks,
            maxCapacity: props.config.maxTasks,
        });
        scalableTarget.scaleOnCpuUtilization("CpuScaling", { targetUtilizationPercent: 60 });
        scalableTarget.scaleOnMemoryUtilization("MemoryScaling", { targetUtilizationPercent: 70 });
        new cdk.CfnOutput(this, "ServiceUrl", {
            value: `http://${this.loadBalancer.loadBalancerDnsName}`,
        });
        new cdk.CfnOutput(this, "EcrRepositoryUri", {
            value: this.ecrRepository.repositoryUri,
        });
        new cdk.CfnOutput(this, "ClusterName", {
            value: props.cluster.clusterName,
        });
        new cdk.CfnOutput(this, "ServiceName", {
            value: this.service.serviceName,
        });
        new cdk.CfnOutput(this, "TaskDefinitionArn", {
            value: taskDef.taskDefinitionArn,
        });
    }
}
exports.AppStack = AppStack;
