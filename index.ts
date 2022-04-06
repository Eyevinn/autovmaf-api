import { AutoabrService } from './src/api/AutoabrService';

// initialize a new instance of AutoabrService
const autoabrService = new AutoabrService();
// register the routes
autoabrService.listen(3000);
