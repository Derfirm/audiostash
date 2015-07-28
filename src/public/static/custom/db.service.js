'use strict';

app.factory('DataService', ['$indexedDB', '$rootScope', '$timeout', 'SockService', 'SYNC_EVENTS',
    function($indexedDB, $rootScope, $timeout, SockService, SYNC_EVENTS){
        var svc = null;
        var sync_list = [];
        var sync_tables = [
            'artist',
            'album',
            'track'
        ];

        function sync_check_start() {
            console.log("sync_check_start");
            sync_list = sync_tables.slice();
            console.log("Sync starting.");
            $rootScope.$broadcast(SYNC_EVENTS.started);
            sync_data_fetch();
        }

        function sync_data_fetch() {
            // If there is nothing more to sync, stop here.
            if(sync_list.length == 0) {
                schedule_next_sync();
                console.log("Sync finished.");
                $rootScope.$broadcast(SYNC_EVENTS.stopped);
                return;
            }

            // Request for data for the first table in the array
            var table_name = sync_list.shift();
            console.log("sync_data_fetch for '"+table_name+"'... Begin");
            SockService.send({
                'type': 'sync',
                'message': {
                    'query': 'request',
                    'ts': localStorage[table_name],
                    'table': table_name
                }
            });
        }

        function sync_request_response(msg) {
            var data = msg['data'];
            var table = msg['table'];
            localStorage[table] = msg['ts'];

            $indexedDB.openStore(table, function(store) {
                for(var i = 0; i < data.length; i++) {
                    if(data[i]['deleted']) {
                        store.delete(data[i]['id']);
                    } else {
                        store.upsert(data[i]);
                    }
                }
                $rootScope.$broadcast(SYNC_EVENTS.newData);
            });
            sync_data_fetch();
        }

        function sync_event(msg) {
            if(msg['error'] == 1) {
                console.log("Error while syncing: '"+msg['data']['message']+"'. Scheduling new sync.");
                schedule_next_sync();
            } else {
                var data = msg['data'];
                if(data['query'] == 'request') {
                    sync_request_response(data);
                }
            }
        }

        function reset_localstorage() {
            if(localStorage.getItem("initialized") == null) {
                for(var i = 0; i < sync_tables.length; i++) {
                    localStorage[sync_tables[i]] = "2000-01-01T00:00:00Z";
                }
                localStorage['initialized'] = 1;
            }
        }

        function schedule_next_sync() {
            svc = $timeout(function() {
                sync_check_start();
            }, 10000);
        }

        function sync_init() {
            reset_localstorage();
            sync_check_start();
        }

        function sync_stop() {
            if(svc != null) {
                $timeout.cancel(svc);
                svc = null;
            }
        }

        function setup() {
            SockService.add_recv_handler('sync', sync_event);
        }

        return {
            setup: setup,
            start: sync_init,
            stop: sync_stop
        }
    }
]);