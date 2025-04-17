import { isBrowser, isJsDom } from 'browser-or-node';
import { File, FileBuffer } from '@environment-safe/file';
export const getConfig = async ()=>{
    //todo: upgrade moka version so we don't need this
    const configFileLocation = ( isBrowser || isJsDom )?'../import-config-fix.json':'import-config-fix.json';
    const file = new File(configFileLocation);
    await file.load();
    return JSON.parse(file.body().cast('string'));
};