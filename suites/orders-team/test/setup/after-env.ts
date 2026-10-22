import { seedData } from '@etm/qa-data';
import './matchers';

const seed = Number(process.env.DATA_SEED);
if (Number.isInteger(seed)) {
  seedData(seed);
}