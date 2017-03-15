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
    RepositoryService.getRepositories().$promise.then(function(repos) {
      $scope.repositories = repos.repositories;
    });
  }
]);

app.controller('TagController', [
  '$scope',
  '$state',
  'RepositoryService',
  function($scope, $state, RepositoryService) {
    $scope.tags = [];
    RepositoryService.getTags({repository: $state.params.repository}).$promise.then(function(result) {
      $scope.tags = _.map(result.tags, function(tag) {
        return {
          name: tag,
          repository: $state.params.repository
        };
      });
      _.each($scope.tags, function(tag) {
        RepositoryService.getManifest({ repository: tag.repository, reference: tag.name }).$promise.then(function(result) {
          if (result && result.schemaVersion && result.schemaVersion == 2) {
            tag.digest = result.id.substr(7, 8); // TODO: Fix me if we stop hardcoding sha256
            RepositoryService.getDetails({ repository: tag.repository, digest: result.config.digest }).$promise.then(function(result2) {
              tag.details = result2;
            });
          }
        });
      });
    });
  }
]);

app.controller('DetailController', [
  '$scope',
  '$state',
  'RepositoryService',
  function($scope, $state, RepositoryService) {
    $scope.tag = {};

    $scope.formatBytes = function(bytes,decimals) {
      if(bytes == 0) return '0 Bytes';
      var k = 1000,
          dm = decimals || 3,
          sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
          i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    RepositoryService.getManifest({repository: $state.params.repository, reference: $state.params.reference }).$promise.then(function(result) {
      $scope.tag.repository = $state.params.repository;
      $scope.tag.reference = $state.params.reference;

      if (result && result.schemaVersion && result.schemaVersion == 2) {
        $scope.tag.digest = result.id.substr(7, 8); // TODO: Fix me if we stop hardcoding sha256
        $scope.tag.size = _.sumBy(result.layers, function(layer) { return layer.size; });
        RepositoryService.getDetails({ repository: $scope.tag.repository, digest: result.config.digest }).$promise.then(function(result2) {
          $scope.tag.details = result2;
        });
      }
    });
  }
]);

app.factory('RepositoryService', [
  '$resource',
  function($resource) {
    return $resource('/v2/_catalog', {}, {
      getRepositories: { isArray: false },
      getTags: { url: '/v2/:repository/tags/list', isArray: false },
      getManifest: { url: '/v2/:repository/manifests/:reference', isArray: false, transformResponse: function(data, headers) {
        response = JSON.parse(data);
        response.id = headers()['docker-content-digest'];
        return response;
      } },
      getDetails: { url: '/v2/:repository/blobs/:digest', isArray: false }
    });
  }
]);
