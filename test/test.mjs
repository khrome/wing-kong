/* global describe:false */
import { chai } from '@environment-safe/chai';
import { it } from '@open-automaton/moka';
import { scanPackage } from '../src/index.mjs';
const should = chai.should();
const someDeps = ['@environment-safe/chai', '@open-automaton/moka'];

describe('wing-kong', ()=>{
    describe('can test itself', ()=>{
        it('generates an importmap', async ()=>{
            const pkg = await scanPackage();
            Object.keys(pkg.modules).length.should.equal(496);
            someDeps.forEach((dep)=>{
                should.exist(pkg.modules[dep]);
            });
        });
    });
});
