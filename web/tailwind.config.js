/** @type {import('tailwindcss').Config} */
// Magna Digi Design System token mapping.
// Source: zeroheight Digi Design System for Internal Web Applications.
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // -----------------------------------------------------------------
        // Digi Aqua — Primary accent (the visual thread of the platform).
        // Derived from Magna Electric Blue. WCAG-AAA tuned.
        // -----------------------------------------------------------------
        aqua: {
          1:  '#DAEBF1',   // hover surface tint
          2:  '#C6E9F5',
          3:  '#8DD3EB',   // dark-mode primary
          4:  '#179AC9',   // base color
          5:  '#5F8C9C',
          6:  '#0E6280',   // light-mode primary
          7:  '#334348',
        },

        // -----------------------------------------------------------------
        // Button-specific accent shades (from button styleguide).
        // -----------------------------------------------------------------
        btn: {
          primary:  '#295D6E',   // Default fill
          focused:  '#2F8EAA',   // Focused state
          disabled: '#7AB4C6',   // Disabled state
          tint:     '#DBEBF1',   // Hover/active tint background
        },

        // -----------------------------------------------------------------
        // Digi Purple — Secondary accent.
        // -----------------------------------------------------------------
        purple: {
          1: '#B4A0FF',
          2: '#5C2D91',  // base
          3: '#36165B',
          4: '#160B29',
        },

        // -----------------------------------------------------------------
        // Semantic colors.
        // -----------------------------------------------------------------
        danger: {
          1: '#FC8692',
          2: '#DC3545',
          3: '#E81123',  // base
          4: '#93000C',
          5: '#3E0202',
        },
        warning: {
          1: '#F06611',
          2: '#D83B01',  // base
          3: '#862C0B',
          4: '#441504',
        },
        caution: {
          1: '#FCE100',
          2: '#FFB900',  // base
          3: '#836209',
          4: '#4C3800',
        },
        success: {
          1: '#48D76E',
          2: '#107C10',  // base
          3: '#145114',
          4: '#052905',
        },
        info: {
          1: '#8DB7E3',
          2: '#208EFF',  // base
          3: '#155EA9',
          4: '#002143',
        },

        // -----------------------------------------------------------------
        // Digi neutral grays.
        // -----------------------------------------------------------------
        gray: {
          0:  '#FFFFFF',
          f9: '#F9F9F9',
          f0: '#F0F0F0',
          d0: '#D0D0D0',
          ba: '#BABABA',
          9:  '#999999',
          8:  '#888888',
          7:  '#777777',
          6:  '#666666',
          5:  '#555555',
          4:  '#444444',
          3:  '#333333',
          2:  '#222222',
          1:  '#111111',
        },

        // -----------------------------------------------------------------
        // Convenience aliases used across the app.
        // -----------------------------------------------------------------
        digi: {
          black: '#000000',
          white: '#FFFFFF',
        },

        // -----------------------------------------------------------------
        // Legacy `mg` neutral scale + `magna` brand kept as aliases so
        // existing components keep compiling while we migrate.
        // -----------------------------------------------------------------
        mg: {
          50:  '#F9F9F9',
          100: '#F0F0F0',
          200: '#E5E7EB',
          300: '#D0D0D0',
          400: '#BABABA',
          500: '#999999',
          600: '#666666',
          700: '#444444',
          800: '#222222',
          900: '#111111',
        },
        magna: {
          red:         '#E81123',  // mapped to Digi Danger 3
          'red-light': '#FC8692',
          'red-dark':  '#93000C',
          blue:        '#0E6280',  // mapped to Digi Aqua 6
          'blue-light':'#179AC9',
          green:       '#107C10',
          'green-light':'#48D76E',
          black:       '#111111',
        },
      },

      fontFamily: {
        // Roboto is the primary typeface; Arial the secondary; system
        // sans-serif the final fallback (per Digi DS typography guide).
        sans: [
          'Roboto',
          'Arial',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },

      boxShadow: {
        // Subtle surface elevation tuned for the Digi neutral palette.
        'digi-sm': '0 1px 2px rgba(17, 17, 17, 0.05)',
        'digi':    '0 2px 6px rgba(17, 17, 17, 0.08)',
        'digi-md': '0 4px 12px rgba(17, 17, 17, 0.10)',
        'digi-lg': '0 12px 32px rgba(17, 17, 17, 0.16)',
      },

      borderRadius: {
        'digi-sm': '4px',
        'digi':    '6px',
        'digi-md': '8px',
        'digi-lg': '12px',
      },
    },
  },
  plugins: [],
};
