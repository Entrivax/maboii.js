import path from 'path';
import webpack from 'webpack';

const configCallback = (env: { [key: string]: string }, argv: webpack.Configuration): webpack.Configuration => {
    const mode = argv.mode || 'development';
    console.log('running webpack with mode:', mode);

    const config: webpack.Configuration = {
        mode,
        target: 'node',
        entry: {
            'maboii': './src/maboii.ts',
        },

        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist'),
            libraryTarget: 'umd',
            library: 'maboiijs',
            umdNamedDefine: true,
        },

        resolve: {
            extensions: ['.ts', '.tsx', '.js'],
        },

        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.node$/,
                    use: 'node-loader'
                }
            ],
        },
    };

    if (mode === 'development') {
        config.devtool = 'inline-source-map';
    }

    return config;
};

export default configCallback;
