def mavenArtifactName = 'apache-maven-3.9.9-bin.tar.gz'

pipeline {
    agent { label 'java-app-builder' }
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
        stage('Install Maven 3.9.9') {
            steps {
                sh """
                    curl --location https://dlcdn.apache.org/maven/maven-3/3.9.9/binaries/${mavenArtifactName} --output ${mavenArtifactName}
                    tar xzvf ${mavenArtifactName}
                """
            }
        }
        stage('Build out Jenkins WAR') {
            steps {
                sh './apache-maven-3.9.9/bin/mvn -am -pl war,bom -Pquick-build clean install'  
            }
        }
    }
    post {
        success {
            archiveArtifacts(artifacts: 'war/target/jenkins.war', fingerprint: true)
        }
        cleanup {
            cleanWs()
        }
    }
}
