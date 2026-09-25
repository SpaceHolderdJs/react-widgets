export { default as LaptopReveal, DEFAULT_MODEL_URL } from './laptop/LaptopReveal';
export {
  default as FoldableReveal,
  DEFAULT_FOLDABLE_MODEL_URL,
} from './foldable/FoldableReveal';
export {
  default as PhoneReveal,
  DEFAULT_HANDSET_MODEL_URL,
  PHONE_FINISHES,
} from './phone/PhoneReveal';

export type {
  RevealProps,
  LaptopRevealProps,
  FoldableRevealProps,
  PhoneRevealProps,
} from './types';

export { SCREEN as LAPTOP_SCREEN, LID_OPEN_DEG } from './laptop/geometry';
export { SCREEN as FOLDABLE_SCREEN, FOLD_OPEN_DEG } from './foldable/geometry';
export { SCREEN as PHONE_SCREEN, TURN_FACING_DEG, facing } from './phone/geometry';
