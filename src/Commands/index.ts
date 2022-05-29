import { program, Option } from 'commander';
import ServeCommand from './Serve';
import ExportDBCommand from './ExportDB';
import { getDefaultConfigPath } from "../CommandsHelper";

program.addOption(new Option('-c, --config <file>', 'Path to config file').env('J3_CONFIG').default(getDefaultConfigPath()));
program.addCommand(ServeCommand);
program.addCommand(ExportDBCommand);

export default program;
