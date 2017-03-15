var app = angular.module('main', [
  'ui.router',
  'ngResource',
  'angularMoment'
]);

app.config([
  '$locationProvider',
  '$urlRouterProvider',
  '$stateProvider',
  function ($locationProvider, $urlRouterProvider, $stateProvider) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false
    });
    $urlRouterProvider.otherwise('/');

    $stateProvider
      .state('repositories', {
        url: '/',
        controller: 'RepositoryController',
        templateUrl: '/views/repositories.jade'
      })
      .state('tags', {
        url: '/tags/{repository}',
        controller: 'TagController',
        templateUrl: '/views/tags.jade'
      })
      .state('details', {
        url: '/details/{repository}/{reference}',
        controller: 'DetailController',
        templateUrl: '/views/details.jade'
      });
  }
]);

app.controller('RepositoryController', [
  '$scope',
  'RepositoryService',
  function($scope, RepositoryService) {
    $scope.repositories = [];
    RepositoryService.getRepositories()
      .$promise
      .then(function(repos) {
        $scope.repositories = repos.repositories;
      });
  }
]);

app.controller('TagController', [
  '$scope',
  '$state',
  '$q',
  'RepositoryService',
  'ManifestService',
  function($scope, $state, $q, RepositoryService, ManifestService) {
    $scope.tags = [];

    RepositoryService.getTags({repository: $state.params.repository})
      .$promise
      .then(function(result) {
        $q.all(_.map(result.tags, function(tag) {
          return ManifestService.getManifest($state.params.repository, tag)
            .then(function(data) {
              return data;
            });
        }))
          .then(function(data) {
            $scope.tags = data;
          });
      });
  }
]);

app.controller('DetailController', [
  '$scope',
  '$state',
  'RepositoryService',
  'ManifestService',
  function($scope, $state, RepositoryService, ManifestService) {
    $scope.tag = {};

    $scope.formatBytes = function(bytes,decimals) {
      if(bytes == 0) return '0 Bytes';
      var k = 1000,
          dm = decimals || 3,
          sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
          i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    ManifestService.getManifest($state.params.repository, $state.params.reference)
      .then(function(tag) {
        $scope.tag = tag;
      });
  }
]);

app.factory('ManifestService', [
  'RepositoryService',
  function(RepositoryService) {
    var getManifest = function(repository, reference) {
      var tag = {
        repository: repository,
        reference: reference
      };

      return RepositoryService.getManifest({repository: repository, reference: reference })
        .$promise
        .then(function(result) {
          tag.manifest = result.data;

          if (result.data && result.data.schemaVersion && result.data.schemaVersion == 2) {
            tag.id = result.id;
            tag.digest = result.id.substr(7); // TODO: Fix me if we stop hardcoding sha256
            tag.size = _.sumBy(result.data.layers, function(layer) { return layer.size; });
            return RepositoryService.getDetails({ repository: tag.repository, digest: result.data.config.digest })
              .$promise
              .then(function(result2) {
                tag.details = result2;
                return tag;
              });
          }
        });
    };

    return {
      getManifest: getManifest
    };
  }
]);

app.factory('RepositoryService', [
  '$resource',
  function($resource) {
    return $resource('/v2/_catalog', {}, {
      getRepositories: { isArray: false },
      getTags: { url: '/v2/:repository/tags/list', isArray: false },
      getManifest: {
        url: '/v2/:repository/manifests/:reference',
        isArray: false,
        transformResponse: function(data, headers) {
          return {
            data: JSON.parse(data),
            id: headers()['docker-content-digest']
          };
        }
      },
      getDetails: { url: '/v2/:repository/blobs/:digest', isArray: false }
    });
  }
]);
