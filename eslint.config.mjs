import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Turn errors into warnings for unused variables
      '@typescript-eslint/no-unused-vars': 'warn',
      
      // Disable the rule that forbids 'any' type (Baileys uses 'any' a lot)
      '@typescript-eslint/no-explicit-any': 'off',
      
      // Disable no-undef because TypeScript handles this better
      'no-undef': 'off',
    }
  }
);
