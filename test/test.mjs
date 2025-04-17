/* global describe:false */
import { chai } from '@environment-safe/chai';
import { Logger, makeConsoleChannel } from '@environment-safe/logger';
import { it } from '@open-automaton/moka';
import { ImportExport } from '../src/index.mjs';
const should = chai.should();
const someDeps = ['@environment-safe/chai', '@open-automaton/moka'];

const logger = new Logger({ 
    //level: Logger.INFO 
    level: 0
});
logger.registerChannel(makeConsoleChannel(console));

describe('wing-kong', ()=>{
    describe('can test itself', ()=>{
        
        it('generates an importmap', async ()=>{
            const wingKong = new ImportExport({ logger });
            const pkg = await wingKong.scanPackage({ package:'wing-kong' });
            const keys = Object.keys(pkg.modules);
            keys.length.should.be.below(50);
            [
                'wing-kong', 'express', 'module', 'path', 
                '@babel/cli', '@babel', 'browser-or-node'
            ].forEach((name)=>{
                should.exist(pkg.modules[name]);
            });
        });
        
        it('generates an importmap with deps', async ()=>{
            const wingKong = new ImportExport({ logger });
            const pkg = await wingKong.scanPackage({
                package:'wing-kong', 
                includeDeps: true
            });
            Object.keys(pkg.modules).length.should.be.above(50);
            someDeps.forEach((dep)=>{
                should.exist(pkg.modules[dep]);
            });
            //
        });
    });
});
