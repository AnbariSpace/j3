import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import { container } from 'tsyringe';
import { setup } from '../CommandsHelper';
import Config from '../Config';
import Database from '../Database';


const command = new Command('export-db');

command.description('Export database entries to a json format. For debug purpose only');
command.option("--path", "Path to a database, default using config database path");
command.option("--out <file-path>", "Path to a json file, default use stdout");
command.action(async ({ path, out }: {path?: string, out?:string}) => {
	await setup();

	const config = container.resolve(Config);
	if (config.data.server === undefined) {
		config.data.server = {
			port: 80,
			host: "0.0.0.0",
		};
	}
	if (path !== undefined) {
		config.data.database = path;
	}

	const database = container.resolve(Database);
	await database.init();

	const all = await database.export();
	const json = JSON.stringify(all, null, 2);
	if (out !== undefined) {
		await writeFile(out, json);
	} else {
		process.stdout.write(json)
	}
});

export default command;
