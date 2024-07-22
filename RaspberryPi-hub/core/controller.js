/**
 * @company Zebresel - Your Agency for digital Media <hello@zebresel.com> https://www.zebresel.com/
 * @author Kristof Friess
 * @createdAt Wed Feb 28 2024
 * @copyright since 2021 by Zebresel - Your Agency for digital Media. All rights reserved.
 * @version 1.0.0
 * 
 * @description 
 */

import ejs from 'ejs'
import path from 'path'

const RENDER_FORMAT_HTML = 'html';
const RENDER_FORMAT_JSON = 'json';

const renderOptions = {
    statusCode: 200,
    layout: true,
    layoutFilePath: 'layout.ejs',
    format: RENDER_FORMAT_HTML
};

export default class Controller {
    #res = null;
    #req = null;
    db = null;

    #opts = {
        // set defaults here
        action: 'index', // is set by the router to handle in view selection
        controller: 'controller', // is set by the router to handle in view selection
    };

    constructor(req, res, opts) {
        this.#opts = Object.assign(this.#opts, opts);
        this.#req = req;
        this.#res = res;
        if(opts.db)
        {
            this.db = opts.db;
            delete opts.db
        }
    }

    async render(data = {}, opts = {}) {
        const renderOpts = Object.assign(renderOptions, opts);

        this.#res.status(renderOpts.statusCode);
        if(renderOpts.format === RENDER_FORMAT_HTML)
        {
            const viewPath = path.join(process.cwd(), 'views', this.#opts.controller, this.#opts.action + '.ejs');
    
            // generate html from view
            let html = await ejs.renderFile(viewPath, data, {
                async: true
            });
    
            // render html into layout
            if (renderOpts.layout === true) {
                const layoutViewPath = path.join(process.cwd(), 'views', renderOpts.layoutFilePath);
    
                // set html for body, which is overwriting other body param if needed
                data.body = html;
    
                // generate html from view
                html = await ejs.renderFile(layoutViewPath, data, {
                    async: true
                });
            }
    
            this.#res.send(html);
        }
        else if(renderOpts.format === RENDER_FORMAT_JSON)
        {
            this.#res.send(JSON.stringify(data));
        }
        else
        {
            this.#res.status(500);
            this.#res.send('Unknown render format used!');
        }
    }
}