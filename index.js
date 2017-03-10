const server = require('./lib/server');
const gc = require('./lib/file-gc');

const args = require('yargs')
  .usage('Usage: $0 [options]')
  .version('Version 0.1')

  .describe('http', 'Use http instead of https')
  .boolean('http')
  .default('http', false)

  .describe('https', 'Use https')
  .boolean('https')
  .default('https', true)

  .describe('cert', 'Filename of cert for SSL server')
  .default('cert', 'cert.pem')
  .alias('c', 'cert')

  .describe('key', 'Filename of key for SSL server')
  .default('key', 'key.pem')
  .alias('k', 'key')

  .describe('passphrase', 'Passphrase for the SSL cert')
  .alias('P', 'passphrase')

  .describe('port', 'Port to serve on')
  .number('port')
  .default('port', 3000)

  .describe('data', 'Directory to store data')
  .default('data', __dirname)
  .alias('d', 'data')

  .help('help')
  .alias('p', 'port')
  .alias('?', 'help')

  .command('gc', 'Run the garbage collection and exit', args => gc.run(args.argv))
  .command(['serve', '*'], 'Start the web server', args => server.run(args.argv))

  .argv;
