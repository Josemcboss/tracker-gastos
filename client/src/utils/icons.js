import {
  Utensils, Car, Home, Gamepad2, HeartPulse, GraduationCap,
  MoreHorizontal, Tag, ShoppingBag, Plane, Music, Coffee,
  Wallet, Briefcase, Gift, Dumbbell, Book, Smartphone,
  Zap, Droplets, Wifi, Bus, Train, Bike,
  Heart, Star, Flag, CircleDot,
} from 'lucide-react';

/**
 * Map of icon slug → React component.
 * Only the icons we actually use are imported to keep the bundle small.
 */
export const ICON_MAP = {
  'utensils':        Utensils,
  'car':             Car,
  'home':            Home,
  'gamepad-2':       Gamepad2,
  'heart-pulse':     HeartPulse,
  'graduation-cap':  GraduationCap,
  'ellipsis':        MoreHorizontal,
  'tag':             Tag,
  'shopping-bag':    ShoppingBag,
  'plane':           Plane,
  'music':           Music,
  'coffee':          Coffee,
  'wallet':          Wallet,
  'briefcase':       Briefcase,
  'gift':            Gift,
  'dumbbell':        Dumbbell,
  'book':            Book,
  'smartphone':      Smartphone,
  'zap':             Zap,
  'droplets':        Droplets,
  'wifi':            Wifi,
  'bus':             Bus,
  'train':           Train,
  'bike':            Bike,
  'heart':           Heart,
  'star':            Star,
  'flag':            Flag,
  'circle-dot':      CircleDot,
};

/** All icon names available for the user to pick from */
export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

/** Resolve an icon slug to a React component, with fallback to Tag */
export function getIcon(name) {
  return ICON_MAP[name] || Tag;
}
