pipeline {
    agent { label 'java-app-builder' }
    stages {
        stage('Checkout jenkinsci/plugin-installation-manager-tool') {
            steps {
                checkout([
                    $class: 'GitSCM',
                    branches: [[ name: '*/master' ]],
                    userRemoteConfigs: [[
                        url: 'https://github.com/jenkinsci/plugin-installation-manager-tool.git'
                    ]]
                ])
            }
        }
        stage('Build out JAR file of Plugin Installation Manager Tool') {
            steps {
                sh 'mvn clean install'  
            }
        }
    }
    post {
        success {
            archiveArtifacts(artifacts: 'plugin-management-cli/target/jenkins-plugin-manager*.jar', fingerprint: true, onlyIfSuccessful: true)
        }
        cleanup {
            cleanWs()
        }
    }
}
