import * as mod from 'node:module';
import * as fs from 'node:fs';
import path from 'node:path';
import { getPackage } from '@environment-safe/package';
import template from 'es6-template-strings';
let internalRequire = null;
if(typeof require !== 'undefined') internalRequire = require;
const ensureRequire = ()=> (!internalRequire) && (internalRequire = mod.createRequire(import.meta.url));

const getCommonJS = (pkg, args, options={})=>{
    return options.prefix + ['node_modules', pkg.name, (
        (pkg.exports && pkg.exports['.'] && pkg.exports['.'].require)?
            pkg.exports['.'].require:
            ((
                (pkg.type === 'commonjs' || !pkg.type)  && 
                (pkg.commonjs  || pkg.main) 
            ) || pkg.commonjs || (args.r && pkg.main))
    )].join('/');
};

const getModule = (pkg, args, options={})=>{
    return options.prefix + ['node_modules', pkg.name, (
        (pkg.exports && pkg.exports['.'] && pkg.exports['.'].import)?
            pkg.exports['.'].import:
            ((
                pkg.type === 'module' && 
                (pkg.module  || pkg.main) 
            ) || pkg.module || (args.r && pkg.main))
    )].join('/');
};



const getURLFrom = async (opts, endpoints)=>{
    const options = typeof opts === 'string'?{ name : opts }:opts;
    if(!options.version) options.version = '';
    let result = null;
    let location = null;
    let packageInfo = null;
    let thisPath = null;
    const keys = Object.keys(endpoints);
    for(let lcv=0; lcv < keys.length; lcv++){
        if(!result){
            ensureRequire();
            location = template(endpoints[keys[lcv]], options);
            thisPath = template('${name}/package.json', options);
            try{
                packageInfo = internalRequire(thisPath);
            }catch(ex){
                packageInfo = { foo: 'bar' };
            }
            const entryLocation = path.join(
                location,
                (packageInfo.module || packageInfo.main || 'index.js')
            );
            result = entryLocation;
        }
    }
    return result;
};

export const createImportMap = async (deps, endpoints)=>{
    const keys = Object.keys(deps);
    const keyMap = {};
    for(let lcv=0; lcv < keys.length; lcv++){
        keyMap[keys[lcv]] = await getURLFrom(keys[lcv], endpoints);
    }
    return keyMap;
};

export const createImportMapForPackage = async (packageLocation, parts=['dependencies'], imports)=>{
    ensureRequire();
    //const packageData = internalRequire(packageLocation);
    const packageData = await scanPackage({
        package: packageLocation,
        includeDeps: true,
        strict: false
    });
    let map = { ...packageData.modules };
    /*parts.forEach((part)=>{
        map = {...map, ...(packageData[part] || {})}
    });*/
    //ensureRequire();
    const config = imports?internalRequire(path.join('..', imports)):{ 'local' : '/node_modules/${name}/'};
    return createImportMap(map, config);
};

export const rewriteHTML = async (filename, pkg, flushToFile)=>{
    const body = (await fs.promises.readFile(filename)).toString();
    const matches = body.match(
        /< *[Ss][Cc][Rr][Ii][Pp][Tt] +[Tt][Yy][Pp][Ee] *= *["']importmap["'](.|\n)*?<\/[Ss][Cc][Rr][Ii][Pp][Tt]>/m
    );
    if(matches && matches[0]){
        const map = await createImportMapForPackage(pkg);
        const result = body.replace(matches[0], (`<script type="importmap">
{
    "imports": ${JSON.stringify(map, null, '    ').replace(/\n/g, '\n        ')}
}
</script>`).replace(/\n/g, '\n    '));
        if(flushToFile){
            fs.promises.writeFile(filename, result);
        }
        return result;
    }
};
let waiting = {};

let remoteRequire = null;

const remotes = {};
const engines = {};

export const registerRequire = (rqr, rslv)=>{
    //require = rqr;
    //resolve = rslv;
};
//*
export const registerRemote = (name, engineName, options={})=>{
    if(!remoteRequire) remoteRequire = mod.createRequire(import.meta.url);
    if(!engines[engineName]) engines[engineName] = remoteRequire(engineName);
    const instance = new engines[engineName](options);
    remotes[name] = instance;
}; //*/

export const mochaEventHandler = (type, event)=>{
    try{
        if(type.message && type.stack){
            //it's an error
        }else{
            switch(type){
                case 'pass':
                    if(waiting[event.title]){
                        const handle = waiting[event.title];
                        delete waiting[event.title];
                        handle.resolve();
                    }else{
                        console.log('unknown event', type, event);
                    }
                    break;
                case 'fail':
                    if(waiting[event.title]){
                        const handle = waiting[event.title];
                        delete waiting[event.title];
                        const error = new Error();
                        error.message = event.err;
                        error.stack = event.stack;
                        error.target = event;
                        handle.reject(error);
                    }else{
                        console.log('unknown event', type, event);
                    }
                    break;
                case 'start':
                case 'end':
            }
        }
    }catch(ex){
        console.log('::', ex);
    }
};

export const scanPackage = async(options={})=>{
    const includeRemotes = options.includeRemotes;
    let includeDeps = options.includeDeps;
    if(includeDeps === null || includeDeps === undefined) includeDeps = true;
    const pkg = await getPackage(options.package);
    const config = pkg.moka || options.config || {};
    if(!pkg) throw new Error('could not load '+path.join(process.cwd(), 'package.json'));
    const dependencies = Object.keys(pkg.dependencies || []);
    const devDependencies = Object.keys(pkg.devDependencies || []);
    const seen = {};
    const mains = {};
    const modules = {};
    const locations = {};
    if(!options.prefix) options.prefix = './';
    const list = dependencies.slice(0).concat(devDependencies.slice(0));
    let moduleName = null;
    let subpkg = null;
    let location = null;
    if(config && config.stub && config.stubs){
        config.stubs.forEach((stub)=>{
            modules[stub] = options.prefix + pkg.moka.stub;
        });
    }
    if(includeDeps){
        while(list.length){
            moduleName = list.shift();
            try{
                ensureRequire();
                if(modules[moduleName]) continue;
                let thisPath = null;
                thisPath = internalRequire.resolve(moduleName);
                const parts = thisPath.split(`/${moduleName}/`);
                parts.pop();
                const localPath = parts.join(`/${moduleName}/`) + `/${moduleName}/`;
                subpkg = await getPackage(localPath);
                if(!subpkg) throw new Error(`Could not find ${localPath}`);
                mains[moduleName] = getCommonJS(subpkg, {}, options);
                seen[moduleName] = true;
                locations[moduleName] = location;
                modules[moduleName] = getModule(subpkg, {}, options);
                Object.keys(subpkg.dependencies || {}).forEach((dep)=>{
                    if(list.indexOf(dep) === -1 && !seen[dep]){
                        list.push(dep);
                    }
                });
            }catch(ex){
                if(options.verbose)  
                    console.log('FAILED', moduleName, ex);
            }
        }
    }
    if(includeRemotes){
        if((!pkg.moka) && options.strict !== false ) throw new Error('.moka entry not found in package!');
        const config = pkg.moka || options.config || {};
        Object.keys(config).forEach((key)=>{
            if(
                key === 'stub' || 
                key === 'stubs' || 
                key === 'require' || 
                key === 'shims' || 
                key === 'global-shims'
            ) return;
            const data = pkg.moka[key];
            const options = data.options || {};
            options.onConsole = (...args)=>{
                let parsedArgs = null;
                if(
                    typeof args[0] === 'string' &&
                    args[0][0] === '[' && 
                    ( parsedArgs = JSON.parse(args[0]) ) && 
                    Array.isArray(parsedArgs) && 
                    typeof parsedArgs[0] === 'string'
                ){
                    //assume this is json-stream reporter output
                    mochaEventHandler(...parsedArgs);
                }else{
                    console.log(...args);
                }
            };
            options.onError = (event)=>{
                mochaEventHandler(event);
            };
            registerRemote(key, data.engine, options);
        });
    }
    if(config && config.stub && config.stubs){
        config.stubs.forEach((stub)=>{
            modules[stub] = options.prefix + config.stub;
        });
    }
    if(config && config.shims){
        Object.keys(config.shims).forEach((shim)=>{
            modules[shim] = options.prefix + config.shims[shim];
        });
    }
    return { modules, pkg };
};