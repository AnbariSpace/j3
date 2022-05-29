import { program } from 'commander';
import path from 'path';
import { container } from 'tsyringe';
import { fileURLToPath } from 'url';
import Config, { ILoggingConfig } from './Config';
import winston from "winston";

export function getDefaultConfigPath(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'config.json');
}

export function getDefaultConfigSchemaPath(): string {
	return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'config-schema.json');
}

export async function setupConfig() {
	if (Config.instance) {
		return container.resolve(Config);
	}
	const config = await Config.fromFile(program.getOptionValue('config'));
	container.registerInstance(Config, config);
	Config.instance = config;
	return config;
}


export function setupLogger() {
	const config = container.resolve(Config);
	const loggingConfig = config.data.logging || {level: "debug", console: false, file: "/var/log/j3.log"} as ILoggingConfig;
	const opts = program.opts() as {
		'logLevel'?: ILoggingConfig['level'],
		'logFile'?: string;
		'verbose'?: boolean;
	};
	if (opts.logLevel !== undefined) {
		loggingConfig.level = opts.logLevel;
	}
	if (opts.logFile !== undefined) {
		loggingConfig.file = opts.logFile;
	}
	if (opts.verbose !== undefined) {
		loggingConfig.console = opts.verbose;
	}

	const transports: winston.transport[] = [];
	if (loggingConfig !== undefined) {
		if (loggingConfig.console) {
			transports.push(new winston.transports.Console());
		}
		if (loggingConfig.file !== undefined) {
			transports.push(new winston.transports.File({ filename: loggingConfig.file }));
		}
	}

	const logger = winston.createLogger({
		transports,
		format: winston.format.combine(
			winston.format.timestamp(),
			winston.format.json()
		),
		level: loggingConfig.level,
	});

	container.registerInstance<winston.Logger>('Logger', logger);

	return logger;
}

export async function setup() {
	const config = await setupConfig();
	const logger = setupLogger();
	return { config, logger };
}
