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
exports.ObservabilityStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
const cloudwatchActions = __importStar(require("aws-cdk-lib/aws-cloudwatch-actions"));
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
class ObservabilityStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const prefix = `${props.config.appName}-${props.config.environment}`;
        const alarmTopic = new sns.Topic(this, "AlarmTopic", {
            topicName: `${prefix}-alarms`,
        });
        const cpuAlarm = new cloudwatch.Alarm(this, "HighCpu", {
            alarmName: `${prefix}-high-cpu`,
            metric: props.service.metricCpuUtilization({ period: cdk.Duration.minutes(1) }),
            threshold: 80,
            evaluationPeriods: 3,
            datapointsToAlarm: 3,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        });
        cpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
        const unhealthyHostCount = props.targetGroup.metrics.unhealthyHostCount({
            statistic: "max",
            period: cdk.Duration.minutes(1),
        });
        const unhealthyHostsAlarm = new cloudwatch.Alarm(this, "UnhealthyHosts", {
            alarmName: `${prefix}-unhealthy-hosts`,
            metric: unhealthyHostCount,
            threshold: 1,
            evaluationPeriods: 2,
            datapointsToAlarm: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        });
        unhealthyHostsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alarmTopic));
        new cloudwatch.Dashboard(this, "Dashboard", {
            dashboardName: `${prefix}-dashboard`,
            widgets: [
                [
                    new cloudwatch.GraphWidget({
                        title: "ECS CPU/Memory",
                        left: [props.service.metricCpuUtilization(), props.service.metricMemoryUtilization()],
                    }),
                ],
                [
                    new cloudwatch.GraphWidget({
                        title: "ALB Request Count",
                        left: [props.loadBalancer.metrics.requestCount()],
                    }),
                ],
            ],
        });
    }
}
exports.ObservabilityStack = ObservabilityStack;
