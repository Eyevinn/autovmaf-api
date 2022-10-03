import { AutoabrService } from './src/api/AutoabrService';

require('dotenv').config()

// initialize a new instance of AutoabrService
const autoabrService = new AutoabrService();
// register the routes
autoabrService.listen(3000);
