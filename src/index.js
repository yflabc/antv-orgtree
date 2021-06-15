import G6 from '@antv/g6'
export default  class simpleTree {
  constructor ( settings ) {
    const {id, data, direction,level, size, fill, stroke, radius, nodeLineWidth, textColor, fontSize,edgeLineWidth,edgeColor, eventType,treeType,quotaName,quotaUnit,highLight,minimap, minimapId, defindNode,nodeHtml,levelColorList } = settings
    console.log('输入的参数===', settings)
    // const colorList = ['#91d5ff', '#99CCCC', '#FFCCCC', '#0099CC', '#99CC66'] // 暂时测试用
    const Color = fill || '#91d5ff' // 全局主色默认配置
    this.marketColor = stroke || fill || '#91d5ff' // 标签颜色，优先继承stroke的颜色
    this.highLight = highLight || Color // 节点高亮色，搜索功能启动时可以设置此功能
    this.levelColorList = levelColorList || [] // 节点分层级颜色
    // 属性
    this.domID = id
    this.level = level// 打开层级
    this.direction = direction || 'TB' //树的方向，TB/LR
    this.size = size || [180, 60] // 节点大小
    this.data = data
    this.__defaultNodeStyle = {
      fill: fill || Color,
      stroke: stroke || Color,
      radius: radius || 5,
      lineWidth: nodeLineWidth || 1,
      cursor: false
    }
    this.__defaultLabelCfg = {
      // position: 'middle',
      // autoRotate: true,
      style: {
        fill: textColor || '#000',
        fontSize: fontSize || 12,
      }
    }

    this.__defaultEdgeStyle = {
      stroke: edgeColor || stroke  || Color,
      lineWidth: edgeLineWidth || 1,
      endArrow: {
        path: defindNode ? /* 'M 0,0 L -10,5 L -10,-5 Z' */ '': G6.Arrow.triangle(10, 10, this._getArrowOffet()), // 使用内置箭头路径函数，参数为箭头的 宽度、长度、偏移量（默认为 0，与 d 对应）
        d: this._getArrowOffet(),
        fill: edgeColor || stroke  || Color,
      }
    }
    this.__plugins = []
    
    this.defindNode = defindNode || false
    this.nodeHtml = nodeHtml
    minimap && minimapId && this.__plugins.push(new G6.Minimap({
      container: minimapId,
      size: [150, 100]
    }))
    // 功能配置
    this.eventType = eventType || 'click' // none 表示没有事件展开节点 默认click事件
    this.treeType = Number(treeType) || 1
    this.quotaName = quotaName
    this.quotaUnit = quotaUnit

    // 内部属性
    this.graph = {}
    
  }

  initTree() {
    // svg渲染模式
    // 自定义dom节点的html
    // 设置定义规则
    this.defindNode && this._domHtmlSet()
    this.level && this.setOpenLevel() // 层级设置
    if (this.levelColorList && this.levelColorList.length > 0) {
      this._addLevelAttr()
    }
    // 初始化图例
    this._createGraph()
    
    /**
     * 事件
     */
    this.eventType === 'click' ? 
      this._bindClick() :
      this.eventType === 'mouseEnter' ?
      this._bindMouseEnter() :
      ''
    // console.log('====>',this.data)
    // 渲染
    this._render()
  }
  _domHtmlSet () {
    if (this.nodeHtml) {
    /**
     * 规则1： 外围只有一个div,即只有一个根节点元素
     * 规则2： 变量控制方式： &&{name}  ===》 对应映射为 ${cfg.name} ，name必须为data里面的属性
     * &{id}&   + cfg.id + 
     */
      let NODESTR = this.nodeHtml.trim()
      let stackNode = [] // 存放当前遍历的元素节点个数，从来查找何时找到根节点
      
      for (let  i = 0; i < NODESTR.length; i++) {
        let next = i === NODESTR.length ? '' : NODESTR[i+1]
        if (NODESTR[i] === '<') {
          // console.log(i, 1000)
          next === '/' ? stackNode.pop(NODESTR[i]) : stackNode.push(NODESTR[i])
          if (!stackNode || stackNode.length === 0) {
            // console.log('=====根节点闭合符号====: <')
            // 当前节点就是根节点闭合元素< 符号
            for (let rootIndex = i; rootIndex < NODESTR.length; rootIndex++) {
              if(NODESTR[rootIndex] === '>' && rootIndex < NODESTR.length - 1) {
                this.nodeHtml = ''
                console.error(' NodeHtml template should contain exactly one root element.')
                return false
              } 

            }
          }
        }
        // console.log(888, NODESTR[i] , stackNode)
      }
      // this.nodeHtml = this.nodeHtml.replace('&&', '$')
      /**
       * 获取根节点的宽高，如果存在，这优先级高于size
       */
      // 合法的html,做一次样式处理
      let startIndex = NODESTR.indexOf('<')
      let endIndex = NODESTR.indexOf('>')
      let rootNode = NODESTR.substr(startIndex, endIndex + 1)
      // console.log('第一个元素内容', rootNode)
      let rootStyle = rootNode.substr(rootNode.indexOf('style'), endIndex)
      // console.log('第一个元素样式', rootStyle, rootStyle.indexOf('"', 0), rootStyle.indexOf('"', 1))
      let start = find(rootStyle, '"', 0)
      let end = find(rootStyle, '"', 1)
      let emWidth = ''
      let emHeight = ''

      rootStyle.substring(start + 1, end-1).split(';').map(um => {
        // 查找width 
        if (um.split(':')[0].trim() === 'width') {
          emWidth = um.split(':')[1].trim().replace('px',  '')
        }
        // height
        if (um.split(':')[0].trim() === 'height') {
          emHeight = um.split(':')[1].trim().replace('px',  '')
        }
      })
      // 重置节点大小
      this._setSize(emWidth, emHeight)
      console.log('===yo===', emWidth, emHeight)
      function find(str,cha,num){
        var x=str.indexOf(cha)
        for(var i=0;i<num;i++){
            x=str.indexOf(cha,x+1)
        }
        return x
      }

      return true
    } else {
      throw console.error('The "nodeHtml" is empty!')
    }
  }
  _analyseHtmlVar(data, cfg) {
     /**
     * 解析html字符串中的变量
     * @param {接口引入的html字符串} data
     * @param {节点的配置项} cfg 
     * @规则 %{id}% ,解析出变量id，并且利用cfg配置项关联出数据； id必须是全局data数据配置好的属性，否则找不到
     */
    // console.log('+++++', data.length, data)
    if (data.indexOf('%{') === -1) {
      // 不存在变量
      return data
    }
    let resultHtml = '' // 解析html的结果
    let connectIndex = 0 // 衔接字符串+变量的位置，避开}% 符号
    let start = 0 // 变量的开始位置
    let end = 0 // 变量结束位置
    // let paramNumber = 0 // 变量个数
    for (let  i = 0; i < data.length; i++) {
      let next = i === data.length ? '' : data[i+1]
      if (data[i] === '%' && next === '{') {
        // 变量的开始标识符
        start = i + 2
      }
      if (data[i] === '}' && next === '%') {
        // 变量的结束标识符
        end = i
        // paramNumber = paramNumber ++
        // console.log('当前变量个数', paramNumber)
        // 完整变量已完成
        if (start !== 0) {
          let param = data.substring(start, end)
          // console.log('变量：', start, end, param)
          resultHtml = resultHtml + data.substring(connectIndex, start - 3) + cfg[param]
          connectIndex = end + 2 // 剔除}% 符号
        }
      }
    }
    // 把变量后面的字符串拼接完整
    resultHtml = resultHtml + data.substring(connectIndex)
    // console.log('结果解析==', resultHtml)
    return resultHtml
  }
  _setSize(w, h) {
    this.size[0] = Number(w) || this.size[0]
    this.size[1] = Number(h) || this.size[1]
  }
  _registerShape () {
    // 自定义节点、边
    let this_ = this
    G6.registerNode(
      `${this_.domID}_node`,
      {
        draw (cfg, group) {
          const styles = this.getShapeStyle(cfg);
          const { labelCfg, style } = cfg
          const w = styles.width
          const h = styles.height
          let pointer = this_._getCollapseXY(w, h)
          // console.log('====', pointer, cfg)
          let keyShape = {}
          const getKeyShape = function () {
            // mainShape 最外层边框
            keyShape = group.addShape('rect', {
              attrs: {
                x: 0,
                y: 0,
                width: w,
                height: h,
                fill: cfg.isMatch ? this_.highLight : (this_.levelColorList.length > 0 ? this_.levelColorList[cfg.level] || style.fill : style.fill),
                stroke: this_.levelColorList.length > 0 ? this_.levelColorList[cfg.level] || style.stroke : style.stroke,
                radius: style.radius
              },
              name: 'mainShape'
            })
            // mainText 数据属性id
            group.addShape('text', {
              attrs: {
                text: this_._fittingString(cfg.label, w, labelCfg.style.fontSize),
                x: w/2,
                y: this_.treeType === 1 ? h / 2 : h / 4, // set y by treeType
                textAlign: 'center',
                textBaseline: 'middle',
                fontSize: labelCfg.style.fontSize,
                fill: labelCfg.style.fill
              },
              name: 'mainText'
            })
            // let imageSize = w > h ? this_.treeType === 1 ? h/2 : h/4 : this_.treeType === 1 ? w/2 : w/4 
            // group.addShape('image', {
            //   attrs: {
            //     x: 0,
            //     y: this_.treeType === 1 ? h / 2 - imageSize/2 : h / 4 - imageSize/2, // set y by treeType
            //     width: imageSize,
            //     height: imageSize,
            //     img: 'https://gw.alipayobjects.com/mdn/rms_8fd2eb/afts/img/A*sxK0RJ1UhNkAAAAAAAAAAABkARQnAQ',
            //   },
            //   // must be assigned in G6 3.3 and later versions. it can be any value you want
            //   name: 'mainImage',
            // })
          }
          const getSubShape = function () {
            // subShape 
            // treeType in 2 or 3
            group.addShape('rect', {
              attrs: {
                x: 0,
                y: h/2,
                width: w,
                height: h/2,
                fill: '#fff',
                stroke: this_.levelColorList.length > 0 ? this_.levelColorList[cfg.level] || style.stroke : style.stroke,
                radius: [0, 0,style.radius, style.radius]
              },
              name: 'subShape'
            })
            /**
             * treeType = 2 指标说明:
             * labelDes (描述说明)
             * treeType = 3 指标说明:
             * name
             * value
             * unit
             */
            const subText = this_.treeType === 2
                            ? this_._fittingString(cfg.labelDes || '本节点内容描述说明', w, labelCfg.style.fontSize)
                            : `${this_.quotaName} : ${cfg.value || '--'} ${this_.quotaUnit}`
            group.addShape('text', {
              attrs: {
                text: subText,
                x: w/2,
                y: 3*h/4,
                textAlign: 'center',
                textBaseline: 'middle',
                fontSize: labelCfg.style.fontSize,
                // fill: labelCfg.style.fill
                fill: '#000'
              },
              name: 'subText'
            })
          }
          // 加载基础shape
          getKeyShape()
          if (this_.treeType === 2 || this_.treeType === 3) {
            getSubShape()
          }
          // market
          if (cfg.children && cfg.children.length) {
            group.addShape('marker', {
              attrs: {
                ...pointer.text,
                r: 6,
                cursor: 'pointer',
                symbol: G6.Marker.collapse,
                stroke: this_.levelColorList.length > 0 ? this_.levelColorList[cfg.level] || this_.marketColor : this_.marketColor,
                fill: '#fff'
              },
              name: 'collapse-icon',
              modelId: cfg.id
            })
          }
          return keyShape
        },
        setState(name, value, item) {
        //  状态名称、状态、元素实例
          if (name === 'collapse') {
            const marker = item.get('group').find((ele) => ele.get('name') === 'collapse-icon')
            const icon = value ? G6.Marker.expand : G6.Marker.collapse
            marker.attr('symbol', icon)
          }
        }
      },
      'rect'
    )
    G6.registerNode(
      `${this_.domID}_htmlNode`,
      {
        draw (cfg, group) {
          const styles = this.getShapeStyle(cfg);
          const { labelCfg, style } = cfg
          const w = styles.width
          const h = styles.height
          let pointer = this_._getCollapseXY(w, h)
          // console.log('===111=', w, h, pointer)
          let key = {}
          /**
           * 自定义Dom
           * 
           */
          /*  `
          <div style="background-color: #fff; border: 2px solid #5B8FF9; border-radius: 5px; width: ${cfg.size[0]
                }px; height: ${cfg.size[1]}px; display: flex;">
            <div style="height: 100%; width: 33%; background-color: #CDDDFD;display: flex;
              align-items: center;justify-content: center;">
              <img alt="img" src="https://gw.alipayobjects.com/mdn/rms_f8c6a0/afts/img/A*Q_FQT6nwEC8AAAAAAAAAAABkARQnAQ" width="20" height="20" />  
            </div>
            <span style="margin: auto; color: #5B8FF9">${cfg.id}</span>
          </div>
          ` */
          // let tmp = `<span style="margin: auto; color: #5B8FF9">${cfg.id}</span>`
          // console.log('222wwww', w, h )

          key = group.addShape('dom', {
            attrs: {
              width: cfg.size[0],
              height: cfg.size[1],
              // 传入 DOM 的 html
              html: this_._analyseHtmlVar(this_.nodeHtml, cfg),
            },
            draggable: true
          })
          // market
          if (cfg.children && cfg.children.length) {
            group.addShape('marker', {
              attrs: {
                ...pointer.text,
                r: 6,
                cursor: 'pointer',
                symbol: G6.Marker.collapse,
                stroke: this_.marketColor,
                // lineWidth: 1,
                fill: '#fff'
              },
              name: 'collapse-icon',
              modelId: cfg.id
            })
          }
          return key
        },
       /*  setState(name, value, item) {
          //  状态名称、状态、元素实例
            if (name === 'collapse') {
              const group = item.getContainer();
              const collapseText = group.find((e) => e.get('name') === 'collapse-text');
              if (collapseText) {
                if (!value) {
                  collapseText.attr({
                    text: '-',
                  });
                } else {
                  collapseText.attr({
                    text: '+',
                  });
                }
              }
            }
          }, */
        setState(name, value, item) {
        //  状态名称、状态、元素实例
          if (name === 'collapse') {
            const marker = item.get('group').find((ele) => ele.get('name') === 'collapse-icon')
            const icon = value ? G6.Marker.expand : G6.Marker.collapse
            marker.attr('symbol', icon)
          }
        }
      },
      'rect'
    )
    G6.registerEdge(`${this_.domID}_line`, {
      
      draw(cfg, group) {
        const startPoint = cfg.startPoint
        const endPoint = cfg.endPoint

        const { style } = cfg
        let nodeLevel  = group.cfg.item.getSource().getModel().level
        // console.log('line===', group.cfg.item.getModel() ,group.cfg.item.getTarget().getModel().level, group.cfg.item.getSource().getModel().level)
        // console.log(group.cfg.item._cfg.group.cfg.item._cfg.group.cfg.item._cfg.target._cfg.model.level)
        // console.log('lineStyle===', cfg)
        // 箭头颜色
        if (this_.levelColorList.length > 0)  cfg.style.endArrow.fill = this_.levelColorList[nodeLevel] || cfg.style.endArrow.fill 
        // 线
        const shape = group.addShape('path', {
          attrs: {
            // fill: 'red',
            stroke: this_.levelColorList.length > 0 ? this_.levelColorList[nodeLevel] || style.stroke : style.stroke,
            endArrow: style.endArrow,
            path: this_._getEdgePath(startPoint, endPoint)
          }
        })
        return shape
      }
    })
  }
  _createGraph(){
    // 初始化实例
    let this_ = this
    const container = document.getElementById(this.domID)
    const width = container.scrollWidth
    const height = container.scrollHeight
    
    const defaultLayout = {
      type: 'compactBox',
      direction: this.direction,
      getId: function getId(d) {
        return d.id
      },
      getHeight: function getHeight() {
        return 16
      },
      getWidth: function getWidth() {
        return 16
      },
      getVGap: function getVGap() { //节点纵向间距
        return this_.size[1]
      },
      getHGap: function getHGap() { // 节点横向间距
        return this_.direction === 'TB' ?  this_.size[0] / 2 : this_.size[0] / 1.2 
      },
    }
    // 注册自定义节点、边
    this._registerShape()
    this.graph = new G6.TreeGraph({
      container: this_.domID,
      width,
      height,
      linkCenter: true,
      plugins: this.__plugins,
      renderer:this.defindNode ? 'svg' : 'canvas',
      modes: {
        default: ['drag-canvas', 'zoom-canvas'],
      },
      defaultNode: {
        type: this.defindNode ? `${this_.domID}_htmlNode` : `${this_.domID}_node`,
        size: this_.size,
        style: this_.__defaultNodeStyle,
        labelCfg: this_.__defaultLabelCfg,
        // anchorPoints: [
        //   [0.5, 0],
        //   [1, 0.5],
        //   [0.5, 1],
        //   [0, 0.5]
        // ]
      },
      defaultEdge: {
        type: `${this_.domID}_line`,
        style: this_.__defaultEdgeStyle,
      },
      // nodeStateStyles: defaultStateStyles,
      // edgeStateStyles: defaultStateStyles,
      layout: defaultLayout,
      // fitView: true, // 是否将图适配到画布中
      // fitCenter: true,
    })
  }
  _getArrowOffet () {
    // 箭头的偏移
    return  this.direction === 'TB' ? this.size[1] / 2 : this.size[0] / 2 + 1
  }
  _updateDefaultEdgeArrow () {
    // 更新箭头的位置
    this.__defaultEdgeStyle.endArrow.path = G6.Arrow.triangle(10, 10, this._getArrowOffet())
    this.__defaultEdgeStyle.endArrow.d = this._getArrowOffet()

  }
  getNodeName (callBack) {
    this.graph.on('mainText:click', (e) => {
      const target = e.target
      callBack(target.attrs.text)
    })
  }
  _fittingString  (str, maxWidth, fontSize)  {
    // 处理问字过长显示为...
    if (!str) return
    const ellipsis = '...';
    const ellipsisLength = G6.Util.getTextSize(ellipsis, fontSize)[0];
    let currentWidth = 0;
    let res = str;
    const pattern = new RegExp('[\u4E00-\u9FA5]+'); // distinguish the Chinese charactors and letters
    str.split('').forEach((letter, i) => {
      if (currentWidth > maxWidth - ellipsisLength) return;
      if (pattern.test(letter)) {
        // Chinese charactors
        currentWidth += fontSize;
      } else {
        // get the width of single letter according to the fontSize
        currentWidth += G6.Util.getLetterWidth(letter, fontSize);
      }
      if (currentWidth > maxWidth - ellipsisLength) {
        res = `${str.substr(0, i)}${ellipsis}`;
      }
    });
    return res;
  }
  _getEdgePath (startPoint, endPoint) {
    // 不同方向的树线的图形配置
    if (this.direction === 'TB') {
      return [
        ['M', startPoint.x, startPoint.y],
        ['L', startPoint.x, (startPoint.y + endPoint.y) / 2],
        ['L', endPoint.x, (startPoint.y + endPoint.y) / 2],
        ['L', endPoint.x, endPoint.y],
      ]
    } else if (this.direction === 'LR' || this.direction === 'RL'){
      return [
        ['M', startPoint.x, startPoint.y],
        ['L', (startPoint.x + endPoint.x)/2, startPoint.y],
        ['L', (startPoint.x + endPoint.x)/2, endPoint.y],
        ['L', endPoint.x, endPoint.y],
      ]
    }
  }
  _getCollapseXY (w, h) {
    // market标识符的位置控制
    if (this.direction === 'TB') {
      return {
        text: {
          x: w/2,
          y: this.defindNode ?  h + 5 : h + 2,
        }
      }
    } else if (this.direction === 'LR') {
      return {
        text: {
          x: w + 5 ,
          y: h/2 -1,
        }
      }
    } else if (this.direction === 'RL'){
      return {
        text: {
          x: -5 ,
          y: h/2 -1,
        }
      }
    }
  }
  _addLevelAttr () {
    // 添加层级属性，为不同层级自定义样式
    this.data.level = 0 // 根元素层级为1
    this.data.label = 'wwww'
    const addLev = function f(data, lev) {
      data.forEach(item => {
        if (item.children && item.children.length > 0) {
          f(item.children, lev + 1)
        }
        item.level = lev + 1
      })
    }
    addLev(this.data.children, 0)
    // console.log('添加层级后的数据', this.data)
  }
  setOpenLevel (level = Number(this.level)) {
    if(level === 1) {
      return this.data.collapsed = true
    }
    // 重置
    this.data.collapsed = false
    // let this_ = this
    const setVel = function f(data, lev) {
      data.forEach(item => {
        if (item.children && item.children.length > 0) {
          f(item.children, lev + 1)
        }
        item.collapsed = lev >= level
      })
    }
    setVel(this.data.children, 2)
  }
  _handleCollapse (e) {
    const target = e.target;
    const id = target.get('modelId');
    const item = this.graph.findById(id);
    const nodeModel = item.getModel();
    nodeModel.collapsed = !nodeModel.collapsed;
    this.graph.layout();
    this.graph.setItemState(item, 'collapse', nodeModel.collapsed);
  }
  _bindClick () {
    this.graph.on('collapse-text:click', (e) => {
      // 文本绑定事件
      this._handleCollapse(e);
    });
    this.graph.on('collapse-back:click', (e) => {
      // 框绑定事件
      this._handleCollapse(e);
    });
    this.graph.on('collapse-icon:click', (e) => {
      this._handleCollapse(e);
    });
    // this.graph.on('mainText:click', (e) => {
    //   const target = e.target
    //   console.log(target)
    //   alert(target.attrs.text)
    // })
   
  }
  _bindMouseEnter () {
    this.graph.on('collapse-text:mouseenter', (e) => {
      // 文本绑定事件
      this._handleCollapse(e);
    });
    this.graph.on('collapse-back:mouseenter', (e) => {
      // 框绑定事件
      this._handleCollapse(e);
    });
  }
  _render () {
    this.graph.data(this.data);
    this.graph.render();
    this.graph.fitView();
  }
  // 对外事件
  EventSetLevel (data) {
    this.setOpenLevel(data)
    this._render()
  }
  EventSearchTree (key) {
    if (!key) {
      const reset = (data) => {
        data.forEach(item => {
          item.isMatch = false
          if (item.children && item.children.length > 0) {
            reset(item.children)
          }
        })
      }
      reset(this.data.children)
      return this._render()
    }
    /**
     * 
     * @param {根节点的孩子数组} data 
     * @param {搜索关键字} key 
     * @returns 匹配上信息的根节点孩子数组
     * 说明：匹配不上会展示根节点
     */
    const search = function f(data, key) {
      if (!data) {
        return []
      }
      let childArr = []
        data.forEach(item => {
          if (item.label.includes(key)) {
             // 匹配上的节点设置高亮
             item.isMatch = true
            const nextChild = f(item.children, key)
            const ItemObj = {
              ...item,
              children: nextChild
            }
            childArr.push(ItemObj)
          } else {
            item.isMatch = false
            if (item.children && item.children.length > 0) {
              const nextChild = f(item.children, key)
              const ItemObj = {
                ...item,
                children: nextChild
              }
              nextChild && nextChild.length > 0 && childArr.push(ItemObj)
            }
          }
          
        })
      return childArr
    }
    let RenderData = JSON.parse(JSON.stringify(this.data)) // 复杂数组深拷贝--孩子数组（除开根节点）
    RenderData.children = search(this.data.children, key) // 搜索结果返回
    /* if (!RenderData.children || RenderData.children.length === 0) {
       // 根节点匹配处理
      RenderData = RenderData.label.includes(key) ? RenderData : {}
    } */
    console.log(RenderData)
    this.graph.data(RenderData)
    this.graph.render()
    this.graph.fitView()
  }
  setDirection (direction) {
    this.direction = direction
    this.graph.destroy() // 清除画布
    this._updateDefaultEdgeArrow()
    this.initTree() // 重现绘制画布
    // 布局渲染样式丢失
    // this.graph.updateLayout({
    //   direction: value
    // })
  }
}