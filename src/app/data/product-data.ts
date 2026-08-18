import { Product } from '../models/product';

const roastedMakhana = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Foxnut_Makhana_-_Nawada_District_-_Bihar_-_1.jpg/1920px-Foxnut_Makhana_-_Nawada_District_-_Bihar_-_1.jpg';
const makhanaGrains = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Euryale_ferox_grains_%281%29.jpg/1280px-Euryale_ferox_grains_%281%29.jpg';
const masalaMakhana = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Makhana_%28Foxnut%29_roasted_with_masala_and_ghee.jpg/1920px-Makhana_%28Foxnut%29_roasted_with_masala_and_ghee.jpg';

export const PRODUCTS: Product[] = [
  { id: 'plain-250', name: 'Makhana Classic', category: 'normal', size: '250g', price: 299, image: roastedMakhana, tone: 'cream', description: 'Clean, lightly roasted fox nuts.' },
  { id: 'plain-500', name: 'Makhana Classic', category: 'normal', size: '500g', price: 549, image: makhanaGrains, tone: 'cream', description: 'A pantry-sized everyday crunch.' },
  { id: 'plain-1000', name: 'Makhana Classic', category: 'normal', size: '1 kg', price: 999, image: roastedMakhana, tone: 'cream', description: 'For families who snack often.' },
  { id: 'plain-2000', name: 'Makhana Classic', category: 'normal', size: '2 kg', price: 1799, image: makhanaGrains, tone: 'cream', description: 'The generous stock-up pack.' },
  { id: 'ready-250', name: 'Peri Peri Pop', category: 'ready-to-eat', size: '250g', price: 349, image: masalaMakhana, tone: 'yellow', description: 'Roasted masala makhana, ready straight from the pack.' },
  { id: 'ready-500', name: 'Peri Peri Pop', category: 'ready-to-eat', size: '500g', price: 649, image: masalaMakhana, tone: 'yellow', description: 'A bigger bag for movie nights.' },
  { id: 'ready-1000', name: 'Peri Peri Pop', category: 'ready-to-eat', size: '1 kg', price: 1199, image: masalaMakhana, tone: 'yellow', description: 'A bold, shareable family pack.' },
  { id: 'ready-2000', name: 'Peri Peri Pop', category: 'ready-to-eat', size: '2 kg', price: 2199, image: masalaMakhana, tone: 'yellow', description: 'The wholesale-ready crunch supply.' },
  { id: 'salty-250', name: 'Salty Makhana', category: 'salty', size: '250g', price: 319, image: roastedMakhana, tone: 'sage', description: 'A clean salted crunch for everyday snacking.' },
  { id: 'salty-500', name: 'Salty Makhana', category: 'salty', size: '500g', price: 589, image: makhanaGrains, tone: 'sage', description: 'A lightly salted sharing pack.' },
  { id: 'salty-1000', name: 'Salty Makhana', category: 'salty', size: '1 kg', price: 1079, image: roastedMakhana, tone: 'sage', description: 'An easy crowd-pleaser for the pantry.' },
  { id: 'salty-2000', name: 'Salty Makhana', category: 'salty', size: '2 kg', price: 1949, image: makhanaGrains, tone: 'sage', description: 'The big pack for family gatherings.' },
  { id: 'tikha-250', name: 'Tikha Makhana', category: 'tikha', size: '250g', price: 359, image: masalaMakhana, tone: 'spice', description: 'A bold chilli kick with every crunch.' },
  { id: 'tikha-500', name: 'Tikha Makhana', category: 'tikha', size: '500g', price: 669, image: masalaMakhana, tone: 'spice', description: 'A fiery snack for spice lovers.' },
  { id: 'tikha-1000', name: 'Tikha Makhana', category: 'tikha', size: '1 kg', price: 1239, image: masalaMakhana, tone: 'spice', description: 'A big bold pack for sharing.' },
  { id: 'tikha-2000', name: 'Tikha Makhana', category: 'tikha', size: '2 kg', price: 2279, image: masalaMakhana, tone: 'spice', description: 'A fiery wholesale-size supply.' }
];
