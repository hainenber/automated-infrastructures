pipelineJob('build-jenkins-war') {
  definition {
    cpsScm {
      scm {
        git {
          remote {
            url('https://github.com/hainenber/automated-infrastructures.git')
          }
          branch('*/main')
        }
      }
      scriptPath('jenkins/pipelines/build_jenkins_war.Jenkinsfile')
      lightweight()
    }
  }
}