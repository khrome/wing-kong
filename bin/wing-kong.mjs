#!/usr/bin/env node

//import * as yargs from 'yargs/yargs';
import * as fs from 'node:fs';
import * as mod from 'node:module';
import * as path from 'node:path';
import { hideBin } from 'yargs/helpers';
import { getPackage } from '@environment-safe/package';
import { createImportMapForPackage, rewriteHTML } from '../src/index.mjs';
let internalRequire = null;
if(typeof require !== 'undefined') internalRequire = require;
const ensureRequire = ()=> (!internalRequire) && (internalRequire = mod.createRequire(import.meta.url));
ensureRequire();
const yargs = internalRequire( 'yargs/yargs');

(async ()=>{
    const packageData = await getPackage();
    yargs(hideBin(process.argv))
        .command('generate [mode]', 'create new importmap', (yargs) => {
            return yargs.positional('mode', {
                describe: 'generate modes',
                default: 'dependencies'
            })
        }, async (argv) => {
            ensureRequire();
            const parts = argv.mode.split('+');
            const rootJSONLocation = internalRequire.resolve(path.join(process.cwd(), 'package.json'));
            const importMap = await createImportMapForPackage(rootJSONLocation, parts, argv.i);
            const result = JSON.stringify(importMap, null, '    ');
            if(argv.f){
              fs.writeFile(argv.f, result, {}, ()=>{
                  console.log(`File "${argv.f}" written.`);
              });
            }else{
                console.log(result);
            }
        })
        .command('rewrite [mode] [file]', 'rewrite importmap script tag', (yargs) => {
            return yargs.positional('mode', {
                describe: 'generate modes',
                default: 'dependencies'
            }).positional('file', {
                describe: 'file to rewrite',
                default: 'package.json'
            });
        }, async (argv) => {
            const rootJSONLocation = internalRequire.resolve(path.join(process.cwd(), 'package.json'));
            await rewriteHTML(argv.file, rootJSONLocation, true);
            //console.log('{}');
        })
        .option('file', {
            alias: 'f',
            type: 'string',
            description: 'output to file'
        })
        .option('imports', {
          alias: 'i',
          type: 'string',
          description: 'import endpoint map'
        })
        .help('help')
        .parse();
})();