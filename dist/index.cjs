"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.registerRemote = exports.ImportExport = void 0;
var _browserOrNode = require("browser-or-node");
var mod = _interopRequireWildcard(require("node:module"));
var fs = _interopRequireWildcard(require("node:fs"));
var _traverseDependencies = require("@open-automaton/traverse-dependencies");
var _template = require("@environment-safe/tag-parser/template");
var _logger = require("@environment-safe/logger");
var _package = require("@environment-safe/package");
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
//import { Path } from '@environment-safe/file';

const template = (template, context) => {
  const temp = new _template.Template(template);
  return temp.render(context);
};
let internalRequire = null;
if (typeof require !== 'undefined') internalRequire = require;
const ensureRequire = () => !internalRequire && (internalRequire = mod.createRequire(require('url').pathToFileURL(__filename).toString()));
let waiting = {};
let remoteRequire = null;
const remotes = {};
const engines = {};
const registerRemote = (name, engineName, options = {}) => {
  if (!remoteRequire) remoteRequire = mod.createRequire(require('url').pathToFileURL(__filename).toString());
  if (!engines[engineName]) engines[engineName] = remoteRequire(engineName);
  const instance = new engines[engineName](options);
  remotes[name] = instance;
};

//TODO: make the pathing windows friendly (there are places where file path and web locations are crossed)
exports.registerRemote = registerRemote;
const notRelative = str => {
  if (str && str[0] === '.' && str[1] === '/') {
    return str.substring(2);
  }
  return str;
};
const defaultImport = exports => {
  if (exports && exports['.']) {
    if (Array.isArray(exports['.'])) {
      if (exports['.'][0] && exports['.'][0].import) return exports['.'][0].import;
    }
    if (exports['.'] && exports['.'].import) {
      if (typeof exports['.'].import === 'string') {
        return exports['.'].import;
      }
      if (typeof exports['.'].import.default === 'string') {
        return exports['.'].import.default;
      }
      if (exports['.'].import.default && exports['.'].import.default.default && typeof exports['.'].import.default.default === 'string') {
        return exports['.'].import.default.default;
      }
    }
  }
  if (exports && exports.import) return exports.import;
  if (!exports) return 'index.js';
};
const pathFromPackage = pkg => {
  const result = pkg.type === 'module' ? pkg.exports ? defaultImport(pkg.exports) : pkg.main : pkg.exports ? defaultImport(pkg.exports) : pkg.module ||
  //is a modules
  pkg.main ||
  //fallback to whatever is in main (prolly cjs)
  'index.js' // fallback to the original default on the assumption
  // 
  ;
  return notRelative(result);
};
const mochaEventHandler = (type, event) => {
  try {
    if (type.message && type.stack) {
      //it's an error
    } else {
      switch (type) {
        case 'pass':
          if (waiting[event.title]) {
            const handle = waiting[event.title];
            delete waiting[event.title];
            handle.resolve();
          } else {
            console.log('unknown event', type, event);
          }
          break;
        case 'fail':
          if (waiting[event.title]) {
            const handle = waiting[event.title];
            delete waiting[event.title];
            const error = new Error();
            error.message = event.err;
            error.stack = event.stack;
            error.target = event;
            handle.reject(error);
          } else {
            console.log('unknown event', type, event);
          }
          break;
        case 'start':
        case 'end':
      }
    }
  } catch (ex) {
    console.log('::', ex);
  }
};
class ImportExport {
  constructor(options = {}) {
    this.logger = options.logger || _logger.Logger.defaultLogger;
    this.options = options;
  }
  async createImportMapForPackage(packageLocation, parts = ['dependencies'], imports, roots = {}) {
    const rootNames = Object.keys(roots);
    const result = await (0, _traverseDependencies.traverse)(packageLocation, async (pkg, state, entry) => {
      const context = {
        name: pkg.name,
        version: pkg.version,
        path: pathFromPackage(pkg)
      };
      if (roots[rootNames[0]]) {
        //todo: maybe cache these over the traversal?
        state.modules[pkg.name] = template(roots[rootNames[0]], context);
      }
      if (rootNames.length === 0) {
        state.modules[pkg.name] = template('node_modules/${name}/${path}', context);
      }
      if (pkg.name === '@open-automaton/traverse-dependencies') {
        return {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {}),
          ...(pkg.peerDependencies || {})
        };
      } else {
        return {
          ...(pkg.dependencies || {}),
          ...(pkg.peerDependencies || {})
        };
      }
    });
    return result.modules;
  }
  async replaceImportMap(html, incoming) {
    const mapStr = typeof incoming === 'string' ? incoming : JSON.stringify(incoming);
    const matches = html.match(/< *[Ss][Cc][Rr][Ii][Pp][Tt] +[Tt][Yy][Pp][Ee] *= *["']importmap["'](.|\n)*?<\/[Ss][Cc][Rr][Ii][Pp][Tt]>/m);
    if (matches && matches[0]) {
      const result = html.replace(matches[0], `<script type="importmap">
    {
        "imports": ${mapStr.replace(/\n/g, '\n        ')}
    }
    </script>`.replace(/\n/g, '\n    '));
      return result;
    } else {
      return html;
    }
  }
  async rewriteHTML(filename, pkg, flushToFile) {
    //const parts = rootJSONLocation.split('/');
    //parts.pop(); //package.json
    //let pkg = parts.pop();
    //if(parts[parts.length-1][0] === '@') pkg = `${parts.pop()}/${pkg}`;
    const body = (await fs.promises.readFile(filename)).toString();
    const matches = body.match(/< *[Ss][Cc][Rr][Ii][Pp][Tt] +[Tt][Yy][Pp][Ee] *= *["']importmap["'](.|\n)*?<\/[Ss][Cc][Rr][Ii][Pp][Tt]>/m);
    if (matches && matches[0]) {
      const map = await this.createImportMapForPackage(pkg);
      const result = body.replace(matches[0], `<script type="importmap">
    {
        "imports": ${JSON.stringify(map, null, '    ').replace(/\n/g, '\n        ')}
    }
    </script>`.replace(/\n/g, '\n    '));
      if (flushToFile) {
        await fs.promises.writeFile(filename, result);
      }
      return result;
    }
  }
  async universalResolve(name) {
    //try{
    let resolution = null;
    if (_browserOrNode.isBrowser || _browserOrNode.isJsDom) {
      resolution = `/node_modules/${name}`;
    } else {
      if (!internalRequire) ensureRequire();
      resolution = internalRequire.resolve(`${name}`);
    }
    if (this.logger) this.logger.log(`RESOLVE ${name} -> ${resolution}`, _logger.Logger.INFO);
    return resolution;
    //}catch(ex){
    //    const pkg = await getPackage(name);
    //}
  }
  async scanPackage(options = {}) {
    let pack = await (0, _package.getPackage)();
    const result = await _traverseDependencies.traverse.unrolled('.', async name => {
      return await this.universalResolve(name);
    }, (pkg, state, entry) => {
      this.logger.log(`scanning ${pkg.name} of ${Object.keys(state.modules).length}`, _logger.Logger.INFO);
      if (!state.modules) state.modules = {};
      state.modules[pkg.name] = '/' + entry.module.replace(/\/\.\//g, '/');
      if (this.logger) this.logger.log(`SCAN> ${pkg.name} -> ${state.modules[pkg.name]}`, _logger.Logger.INFO);
      const deps = options.includeDeps ? pkg.dependencies || {} : {};
      const devDeps = options.includeDeps ? pkg.devDependencies || {} : {};
      const peerDeps = options.includeDeps ? pkg.peerDependencies || {} : {};
      if (pkg.name === pack.name) {
        pack = pkg;
        const config = pkg.moka || options.config || {};
        if (options.includeRemotes) {
          if (!pkg.moka && options.strict !== false) throw new Error('.moka entry not found in package!');
          Object.keys(config).forEach(key => {
            if (key === 'stub' || key === 'stubs' || key === 'require' || key === 'shims' || key === 'global-shims') return;
            const data = pkg.moka[key];
            const remoteOptions = data.options || {};
            remoteOptions.onConsole = (...args) => {
              let parsedArgs = null;
              if (typeof args[0] === 'string' && args[0][0] === '[' && (parsedArgs = JSON.parse(args[0])) && Array.isArray(parsedArgs) && typeof parsedArgs[0] === 'string') {
                //assume this is json-stream reporter output
                mochaEventHandler(...parsedArgs);
              } else {
                console.log(...args);
              }
            };
            remoteOptions.onError = event => {
              mochaEventHandler(event);
            };
            if (options.registerRemote) {
              this.logger.log(`REGISTER REMOTE ${key}`, _logger.Logger.INFO);
              options.registerRemote(key, data.engine, options);
            }
          });
        }
        if (config && config.stub && config.stubs) {
          config.stubs.forEach(stub => {
            state.modules[stub] = (options.prefix || '') + config.stub;
          });
        }
        if (config && config.shims) {
          Object.keys(config.shims).forEach(shim => {
            state.modules[shim] = (options.prefix || '') + config.shims[shim];
          });
        }
      }
      if (pkg.name === pack.name) {
        return {
          ...deps,
          ...devDeps,
          ...peerDeps
        };
      } else {
        return {
          ...deps,
          ...peerDeps
        };
      }
    });
    //const final = Object.keys(result.modules).length
    const errorReturns = (0, _traverseDependencies.errors)(result);
    for (let lcv = 0; lcv < errorReturns.names.length; lcv++) {
      this.logger.log(`Failed to import module: ${errorReturns.names[lcv]}`, _logger.Logger.INFO);
      this.logger.log(errorReturns.errors[lcv].stack.toString().replace('Error:', 'Warning:'), _logger.Logger.INFO);
    }
    const modKeys = Object.keys(result.modules);
    const modules = {};
    let module = null;
    for (let lcv = 0; lcv < modKeys.length; lcv++) {
      module = result.modules[modKeys[lcv]];
      if (module[module.length - 1] !== '/') {
        modules[modKeys[lcv]] = module;
      } else {
        //console.log('trimmed', modKeys[lcv], module)
      }
    }
    return {
      modules
      //pkg: pack
    };
  }
}
exports.ImportExport = ImportExport;