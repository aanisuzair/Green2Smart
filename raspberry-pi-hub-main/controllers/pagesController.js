/**
 * @company Zebresel - Your Agency for digital Media <hello@zebresel.com> https://www.zebresel.com/
 * @author Kristof Friess
 * @createdAt Wed Feb 28 2024
 * @copyright since 2021 by Zebresel - Your Agency for digital Media. All rights reserved.
 * @version 1.0.0
 * 
 * @description 
 */


import Controller from '../core/controller.js';

export default class PagesController extends Controller {

    async actionIndex() {
        // load sensor data / config from sql
        let config = await this.db.models.Config.findOne();
        if(config == null)
        {
            config = new this.db.models.Config();
            await config.save();
        }
        this.render({config:config});
    }
}

