import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        shopee: '#ee4d2d',
        tiktok: '#000000',
      },
    },
  },
  plugins: [],
} satisfies Config;
