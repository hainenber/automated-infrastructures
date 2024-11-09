pipeline {
    agent { label 'javascript-app-builder' }

    options {
        // Display ANSI escape sequences, including color, to Console Output
        ansiColor('xterm')
    }

    stages {
        stage('Checkout automated-infrastructures/jenkins') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[ name: '*/main' ]],
                    userRemoteConfigs: [[
                        url: 'https://github.com/hainenber/automated-infrastructures.git'
                    ]]
                ])
            }
        }
        step('Install npm dependencies') {
            dir('scripts') {
                steps {
                    sh 'npm install'
                }
            }
        }
        stage('Synchronize forked repos with their upstream') {
            dir('scripts') {
                steps {
                    sh 'npm run sync_forked_repos'  
                }
            }
        }
    }

    post {
        cleanup {
            cleanWs()
        }
    }
}
