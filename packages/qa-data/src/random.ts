import { faker } from '@faker-js/faker';

let currentSeed = Math.floor(Math.random() * 1_000_000);
faker.seed(currentSeed);

export function seedData(seed: number): void {
  currentSeed = seed;
  faker.seed(seed);
}

export function getDataSeed(): number {
  return currentSeed;
}

export { faker };