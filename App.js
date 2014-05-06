  Ext.define('CustomApp', {
     extend: 'Rally.app.App',
     componentCls: 'app',
     items:[
        {
            xtype: 'container',
            itemId: 'widgets',
        },
        {
            xtype: 'container',
            itemId:'gridContainer',
            columnWidth: 1
        }
        ],
     launch: function(){
 
        var that = this;
        that.tagPicker = Ext.create('Rally.ui.picker.TagPicker',{
            itemId: 'tagpicker'
        });
        
        that.down('#widgets').add(this.tagPicker);
        
        that.down('#widgets').add({
            xtype: 'rallybutton',
            id: 'getTasks',
            text: 'Get Defects',
            handler: function(){
                that._getDefects();
            }
        })
     },
     
     _getDefects: function() {
        var count = 0;
        var that = this;
        var selectedTagRecords = this.tagPicker._getRecordValue();
        that._tagNames = [];
        that._defectsPerTag = {};
        console.log(selectedTagRecords.length);
        if (selectedTagRecords.length > 0) {
             var tagFilters = [];
             _.each(selectedTagRecords, function(thisTag) {
                var thisTagName = thisTag.get('Name');
                that._tagNames.push(thisTagName); 
                var tagFilter = {
                    property: 'Tags.Name',
                    operator: 'contains',
                    value: thisTagName
                };
                tagFilters.push(tagFilter);
            });
            that._defectsPerTag = _.object(_.map(that._tagNames, function(item) {
                return [item, count]
            }));
        }
        
        else{
            that._noTagsNotify();       
        }
        Ext.create('Rally.data.wsapi.Store', {
                model: 'Defect',
                fetch: ['FormattedID', 'Name', 'State'],
                autoLoad: true,
                listeners: {
                    load: this._onDefectsLoaded,
                    scope: this
                },
                filters: Rally.data.wsapi.Filter.or(tagFilters)
        });
    },
    
     _onDefectsLoaded: function(store, records) {
        var that = this;
        var promises = [];

        if (records.length === 0) {
            that._noArtifactsNotify();
        }

        _.each(records, function(artifact) {
            promises.push(that._getArtifactTags(artifact, that));
        });
        
        Deft.Promise.all(promises).then({
            success: function(results) {
                that._artifactsWithTags = results;
                console.log('that._defectsPerTag', that._defectsPerTag);
                that._makeGrid();
            }
        });
    },

     _getArtifactTags: function(artifact, scope) {
        var that = this;
        
        var deferred                = Ext.create('Deft.Deferred');
        var that                      = scope;

        var tags                    = [];

        var artifactRef             = artifact.get('_ref');
        var artifactObjectID        = artifact.get('ObjectID');
        var artifactFormattedID     = artifact.get('FormattedID');
        var artifactName            = artifact.get('Name');
        var artifactState            = artifact.get('State');
        var tagsCollection          = artifact.getCollection("Tags", {fetch: ['Name', 'ObjectID']});
        var tagCount                = tagsCollection.getCount();

        tagsCollection.load({
            callback: function(records, operation, success) {
                _.each(records, function(tag) {
                    tags.push(tag);
                    for (k in that._defectsPerTag){
                        if (k === tag.get('Name')) {
                            that._defectsPerTag[k]++;
                        }
                    }
                });
                result = {
                    "_ref"          : artifactRef,
                    "ObjectID"      : artifactObjectID,
                    "FormattedID"   : artifactFormattedID,
                    "Name"          : artifactName,
                    "State"         : artifactState,
                    "Tags"          : tags
                };
                deferred.resolve(result);
            }
        });

        return deferred;
    },

     _makeGrid: function() {
        var that = this;
        console.log('that._artifactsWithTags', that._artifactsWithTags)

        if (that._artifactTagsGrid) {
            that._artifactTagsGrid.destroy();
        }

        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: that._artifactsWithTags,
            pageSize: 1000,
            remoteSort: false
        });

        that._artifactTagsGrid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'artifactGrid',
            store: gridStore,
            columnCfgs: [
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID', xtype: 'templatecolumn',
                    tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
                },
                {
                    text: 'Name', dataIndex: 'Name'
                },
                {
                    text: 'State', dataIndex: 'State'
                },
                {
                    text: 'Tags', dataIndex: 'Tags',
                    renderer: function(values) {
                        var tagArray = [];
                        _.each(values, function(tag) {
                            var tagName = tag.get('Name');
                            tagArray.push(tagName);
                        });
                        return tagArray.join(', ');
                    },
                    flex: 1
                }
            ]
        });

        that.down('#gridContainer').add(that._artifactTagsGrid);
        that._artifactTagsGrid.reconfigure(gridStore);
        that._prepareChart();
    },
    
    _noArtifactsNotify: function() {
        this.down('#gridContainer').add({
            xtype: 'container',
            html: "No artifacts found matching some or all selected tags."
        });
    },
     _prepareChart: function(){
        var that = this;
        that._series = [];
        that._categories = [];
        that._data = [];
        var numberOfTags = _.size(that._defectsPerTag);
        console.log('numberOfTags', numberOfTags);
      
        
        
        for (k in that._defectsPerTag){
            that._categories.push(k);
            that._data.push({name: k, y: that._defectsPerTag[k]})
        }
        that._makeChart();
        
        
     },
    
    _makeChart: function(){
       if (this.down('#myChart')) {
            this.remove('myChart');
        }
        this.add(
        {
            xtype: 'rallychart',
            itemId: 'myChart',
            width: 600,
            chartConfig: {
                chart:{
                type: 'column',
                zoomType: 'xy'
                },
                title:{
                    text: 'Defects per Tag'
                },
                xAxis: {
                    title: {
                        enabled: true,
                        tickInterval: 1,
                        text: 'tags'
                },
                startOnTick: true,
                endOnTick: true,
                showLastLabel: true,
                allowDecimals: false,
                },
                yAxis:{
                    title: {
                        text: 'Defects'
                },
                allowDecimals: false
                },
            },
                            
            chartData: { 
                categories: this._categories,
                series:[
                    {
                       type: 'column',
                       name: 'Tags',
                       data: this._data
                    }
                    
                ]
                
                
            }
          
        });
        this.down('#myChart')._unmask(); 
     
    }
 });