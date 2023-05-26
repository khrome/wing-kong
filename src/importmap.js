const https = require('https');
const template = require('es6-template-strings');
const path = require('path')
const url = require('url')

const getURL = async (url)=>{
    return await new Promise((resolve, reject)=>{
        const request = https.request(url, async (response) => {
            if(response.statusCode === 301 || response.statusCode === 302) {
                const location = (new URL(response.headers.location, url)).toString();
                resolve(await getURL(location));
            }
            let data = '';
            response.on('data', (chunk) => {
                data = data + chunk.toString();
            });
          
            response.on('end', () => {
                const body = data;
                resolve(body);
            });
        })
          
        request.on('error', (error) => {
            reject(error);
        });
          
        request.end() 
    });
}

const getURLFrom = async (opts, endpoints)=>{
    const options = typeof opts === 'string'?{ name : opts }:opts;
    if(!options.version) options.version = '';
    let result = null;
    let location = null;
    let packageInfo = null;
    let body = null;
    const keys = Object.keys(endpoints);
    for(let lcv=0; lcv < keys.length; lcv++){
        if(!result){
            location = template(endpoints[keys[lcv]], options);
            packageInfo = require(template('${name}/package.json', options));
            const entryLocation = path.join(
                location,
                (packageInfo.module || packageInfo.main || 'index.js')
            );
            body = await getURL(entryLocation);
            if(body) result = entryLocation;
        }
    }
    return result;
    
}


module.exports = {
    createImportMap : async (deps, endpoints)=>{
        const keys = Object.keys(deps);
        const keyMap = {};
        for(let lcv=0; lcv < keys.length; lcv++){
            keyMap[keys[lcv]] = await getURLFrom(keys[lcv], endpoints);
        }
        return keyMap;
    }
}