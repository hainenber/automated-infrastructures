pipelineJob('build-jenkins-plugin-manager-war') {
  definition {
    cpsScm {
      scm {
        git {
          remote {
            url('https://github.com/hainenber/jenkins-labs.git')
          }
          branch('*/main')
        }
      }
      scriptPath('pipelines/build_jenkins_plugin_manager_jar.Jenkinsfile')
      lightweight()
    }
  }
}