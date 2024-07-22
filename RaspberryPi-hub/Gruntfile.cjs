/**
 * @company Zebresel - Your Agency for digital Media <hello@zebresel.com> https://www.zebresel.com/
 * @author Kristof Friess
 * @createdAt Fri Apr 29 2022
 * @copyright since 2021 by Zebresel - Your Agency for digital Media. All rights reserved.
 * @version 1.0.0
 * 
 * @description 
 */


module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        less: {
            development: {
                options: {
                    compress: true,
                    yuicompress: true,
                    optimization: 2
                },
                files: {
                    'public/assets/css/style.css': 'src/less/style.less'
                }
            }
        },
        watch: {
            styles: {
                options: {
                    livereload: true,
                    spawn: false,
                    event: ['added', 'deleted', 'changed']
                },
                files: [
                    'src/less/**/*.less',
                ],
                tasks: ['less'],
            },
            options: {
                livereload: true,
                span: true,
            },
        }
    });

    // Load the plugin that provides the task.
    grunt.loadNpmTasks('grunt-contrib-less');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['watch']);
    grunt.registerTask('build', ['less']);

};
