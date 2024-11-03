pipeline {
    agent { label 'java-app-builder' }

    options {
        // Display ANSI escape sequences, including color, to Console Output
        ansiColor('xterm')
    }

    stages {
        stage('Checkout jenkinsci/jenkins') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[ name: '*/master' ]],
                    userRemoteConfigs: [[
                        url: 'https://github.com/jenkinsci/jenkins.git'
                    ]]
                ])
            }
        }
        stage('Build out Jenkins WAR') {
            steps {
                sh 'mvn -am -pl war,bom -Pquick-build clean install'  
            }
        }
    }

    post {
        success {
            archiveArtifacts(artifacts: 'war/target/jenkins.war', fingerprint: true, onlyIfSuccessful: true)
        }
        cleanup {
            cleanWs()
        }
    }
}
