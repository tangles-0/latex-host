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
exports.DataStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const kms = __importStar(require("aws-cdk-lib/aws-kms"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
class DataStack extends cdk.Stack {
    imageBucket;
    dbInstance;
    dbCredentialsSecret;
    appSecret;
    rateLimitTable;
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefix = `${props.config.appName}-${props.config.environment}`;
        const dataKey = new kms.Key(this, "DataKey", {
            alias: `alias/${prefix}-data`,
            enableKeyRotation: true,
        });
        this.imageBucket = new s3.Bucket(this, "ImageBucket", {
            bucketName: `${prefix}-images-${this.account}-${this.region}`,
            encryption: s3.BucketEncryption.KMS,
            encryptionKey: dataKey,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            enforceSSL: true,
            versioned: true,
            lifecycleRules: [
                {
                    noncurrentVersionExpiration: cdk.Duration.days(30),
                },
            ],
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            autoDeleteObjects: false,
        });
        const dbSecurityGroup = new ec2.SecurityGroup(this, "DbSecurityGroup", {
            vpc: props.vpc,
            allowAllOutbound: false,
            description: "RDS PostgreSQL security group",
            securityGroupName: `${prefix}-db-sg`,
        });
        dbSecurityGroup.addIngressRule(props.appSecurityGroup, ec2.Port.tcp(5432));
        this.dbInstance = new rds.DatabaseInstance(this, "Database", {
            vpc: props.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
            securityGroups: [dbSecurityGroup],
            databaseName: "latex",
            credentials: rds.Credentials.fromGeneratedSecret("latex_app"),
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16,
            }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, props.config.dbInstanceType.endsWith("large")
                ? ec2.InstanceSize.LARGE
                : ec2.InstanceSize.MEDIUM),
            allocatedStorage: props.config.dbAllocatedStorageGiB,
            maxAllocatedStorage: props.config.dbAllocatedStorageGiB * 4,
            storageEncrypted: true,
            multiAz: props.config.dbMultiAz,
            backupRetention: cdk.Duration.days(props.config.dbBackupRetentionDays),
            deleteAutomatedBackups: false,
            deletionProtection: props.config.environment === "prod",
            removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
            cloudwatchLogsExports: ["postgresql"],
            cloudwatchLogsRetention: cdk.aws_logs.RetentionDays.ONE_MONTH,
        });
        this.dbCredentialsSecret = this.dbInstance.secret;
        this.appSecret = new secretsmanager.Secret(this, "AppRuntimeSecret", {
            secretName: `${prefix}/app/runtime`,
            description: "Runtime app secrets for latex",
            generateSecretString: {
                secretStringTemplate: JSON.stringify({}),
                generateStringKey: "NEXTAUTH_SECRET",
                passwordLength: 64,
            },
        });
        this.rateLimitTable = new dynamodb.Table(this, "RateLimitTable", {
            tableName: `${prefix}-rate-limit`,
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            partitionKey: {
                name: "pk",
                type: dynamodb.AttributeType.STRING,
            },
            timeToLiveAttribute: "expiresAt",
            pointInTimeRecoverySpecification: {
                pointInTimeRecoveryEnabled: true,
            },
            encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
            encryptionKey: dataKey,
            removalPolicy: props.config.environment === "prod" ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
        });
    }
}
exports.DataStack = DataStack;
