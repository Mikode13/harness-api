import codeQuality from '@mikode13/code-quality/base';

export default [
	...codeQuality,
	{
		files: ['**/*.ts'],
		// A Nest module is an empty class its decorator configures, so only decorated empty
		// classes are allowed. See the README's exception.
		rules: {
			'@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
		},
	},
];
