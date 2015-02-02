var fs = require('fs');
var readline = require('readline');
var prompt = require('prompt');

var Stream = require('stream');
var LineByLineReader = require('line-by-line')
var ProgressBar = require('progress');

var MAX_SPAWN_LIMIT;
var lineCount = 1;
var sourceFile;
var destinationFile;

var mainInStream;
var mainOutStream;
var mainReadLine;

var promptSchema = {
    properties: {
        source: {
            type: 'string',
            required: true
        },
        destination: {
            type: 'string',
            required: true
        },
        threads: {
            type: 'number',
            message: 'Name must be only numbers',
            default: 500
        }
    }
};

prompt.get(promptSchema, function (err, result) {
    if (err) {
        console.log(err);
    }

    sourceFile = result.source;
    destinationFile = result.destination;
    MAX_SPAWN_LIMIT = result.threads;

    mainInStream = fs.createReadStream(sourceFile);
    mainOutStream = new Stream;
    mainReadLine = readline.createInterface(mainInStream, mainOutStream);

    mainReadLine.on('line', function (line) {
        lineCount++;
    });

    mainReadLine.on('close', function () {
        lineCount--;

        var processLineCount = 0;
        var bar = new ProgressBar(':bar', {total: lineCount});
        var bar = new ProgressBar('Resolving :total IPs [:bar] :percent Complete - Resolved IPs :current in :elapsed seconds.  ', {
            complete: '*',
            incomplete: '.',
            width: 40,
            total: lineCount
        });

        var lr = new LineByLineReader(sourceFile);
        var foo = [];

        lr.on('line', function (line) {
            if (processLineCount === 0) {
                processLineCount++;
            } else {
                var data = line.split(",");

                foo.push(new CmdExec('dig', ['-x', data[0], '+noall', '+answer'], data,
                    function (me, data) {
                        me.stdout += data.toString();
                    },
                    function (me) {
                        me.exit = 1;
                        me.stdout = me.stdout.replace(/\n/g, ",");
                        me.dns = me.stdout.split('PTR');
                        if (me.dns[1]) {
                            me.dns[1] = me.dns[1].trim().split(',')[0]
                        }

                        var results = me.data[0] + "," + me.data[1] + "," + me.dns[1] + '\n';

                        fs.appendFileSync(destinationFile, results);

                        bar.tick();
                        foo.pop();
                        lr.resume();
                        processLineCount++;
                    }
                ));

                if (foo.length === MAX_SPAWN_LIMIT) {
                    lr.pause();
                }
            }
        });

        lr.on('end', function () {
        });
    });
});

function CmdExec(cmd, args, data, cb_stdout, cb_end) {
    var spawn = require('child_process').spawn;
    var child = spawn(cmd, args);
    var me = this;

    me.exit = 0;
    me.data = data;

    me.stdout = '----';

    child.stdout.on('data', function (data) {
        cb_stdout(me, data)
    });

    child.stdout.on('end', function () {
        cb_end(me);
    });
}

prompt.start();


