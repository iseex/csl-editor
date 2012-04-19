"use strict";

var CSLEDIT = CSLEDIT || {};

CSLEDIT.editorPage = (function () {
	var editTimeout,
		styleURL,
		oldSelectedNode,
		hoveredNodeStack = [],
		highlightedCss,
		selectedCss,
		unHighlightedCss,
		highlightedTreeNodes = [],
		selectedCslId = -1,
		cslTreeView,
		controller;

	var normalisedColor = function (color) {
		return $('<pre>').css({"color" : color}).css("color");
	};

	highlightedCss = {
			"color" : normalisedColor("black"),
			"background-color" : normalisedColor("#bbffbb"),
			"cursor" : "pointer"
		};
	selectedCss = {
			"color" : normalisedColor("white"),
			"background-color" : normalisedColor("#009900"),
			"cursor" : "default"
		};
	unHighlightedCss = {
			"color" : "",
			"background-color" : "",
			"cursor" : "default"
		};

	// resizing that can't be done with CSS
	var setSizes = function () {
		var mainContent = $('#mainContainer');

		mainContent.height(mainContent.parent().height() - 60);
		$("#treeEditor").height($("#treeEditor").parent().height());
	};

	var addToHoveredNodeStack = function (target) {
		// build stack 'backwards' from the inner node outwards
		var parentNode;
		
		if (typeof target.attr("cslid") !== "undefined") {
			hoveredNodeStack.unshift(target.attr("cslid"));
		}

		parentNode = target.parent();
		if (parentNode.length > 0) {
			addToHoveredNodeStack(parentNode);
		}
	}

	var removeFromHoveredNodeStack = function (nodeIndex) {
		// pop all nodes up to and including the target node
		var poppedNode;

		if (hoveredNodeStack.length > 0) {
			poppedNode = hoveredNodeStack.pop();
			unHighlightNode(poppedNode);

			if (poppedNode == nodeIndex) {
				return;
			}
			removeFromHoveredNodeStack (nodeIndex);
		}
	}

	var highlightNode = function (nodeStack) {
		var cslId = nodeStack[nodeStack.length - 1];

		highlightOutput(cslId);

		// undo previous highlighting
		unHighlightTree();
		highlightTree(nodeStack, null, 0);
	};

	var highlightOutput = function (cslId)
	{
		var node = $('span[cslid="' + cslId + '"]');
		if (node.css("background-color") == selectedCss["background-color"])
		{
			// leave alone - selection takes precedence
		} else {
			node.css(highlightedCss);
		}
	};

	var reverseSelectNode = function () {
		var index,
			cslId = hoveredNodeStack[hoveredNodeStack.length - 1];

		assert(hoveredNodeStack.length > 0);

		for (index = 0; index < hoveredNodeStack.length; index++) {
			cslTreeView.expandNode(hoveredNodeStack[index]);
		}

		if (selectedCslId !== cslId) {
			selectedCslId = cslId;
			cslTreeView.selectNode(cslId);
		}
	};

	var unHighlightTree = function () {
		var node;

		while (highlightedTreeNodes.length > 0) {
			node = highlightedTreeNodes.pop();
			node.css(unHighlightedCss);
			node.css("cursor", "");
		}
	};

	// highlight node and all parents, stopping at the "style" node
	var highlightTree = function (nodeStack, node, depth) {
		var nodeIndex, node, parentNode, parentIndex, highlightedNode;

		if (node === null) {
			nodeIndex = nodeStack.pop();
			if (typeof nodeIndex === "undefined") {
				return;
			}
			node = $('li[cslid="' + nodeIndex + '"]');
		}

		depth++;
		assert(depth < 50, "stack overflow!");

		if (node.is('li')) {
			highlightedNode = node.children('a');
			highlightedTreeNodes.push(highlightedNode);
			highlightedNode.css(highlightedCss);
			highlightedNode.css("cursor", "");
		}

		parentNode = node.parent();
		assert(parentNode != false, "no parent node");

		parentIndex = parentNode.attr("cslid");

		if (parentIndex != "0") {
			if (nodeStack[nodeStack.length - 1] === parentIndex) {
				nodeStack.pop();
			}
			highlightTree(nodeStack, parentNode, depth);
		} else {
			// highlight any remaining nodes in the call stack
			// (e.g. if a macro was called)
			highlightTree(nodeStack, null, depth);
		}
	};

	var unHighlightNode = function (nodeIndex) {
		var	node = $('span[cslid="' + nodeIndex + '"]');

		if (node.css("background-color") == selectedCss["background-color"])
		{
			// leave alone - selection takes precedence
		} else {
			node.css(unHighlightedCss);
		}
	};

	var setupSyntaxHighlightForNode = function (cslId) {
		$('span[cslid="' + cslId + '"]').hover(
			function (event) {
				var target = $(event.target).closest("span[cslid]");
				
				// remove all
				removeFromHoveredNodeStack(-1);

				// populate hovered node stack
				addToHoveredNodeStack(target);

				var lastNode = hoveredNodeStack[hoveredNodeStack.length - 1];
				assertEqual(lastNode, target.attr("cslid"), "applySyntax");

				if (hoveredNodeStack.length > 0) {
					highlightNode(hoveredNodeStack.slice());
				}
			},
			function () {
				removeFromHoveredNodeStack(cslId);
				
				if (hoveredNodeStack.length > 0) {
					highlightNode(hoveredNodeStack.slice());
				} else {
					unHighlightTree();
				}
			}
		);

		// set up click handling
		$('span[cslid="' + cslId + '"]').click( function () {
			reverseSelectNode(cslId);
		});

		// set up hovering over tree nodes
		$('li[cslid="' + cslId + '"] > a').unbind('mouseenter mouseleave');
		$('li[cslid="' + cslId + '"] > a').hover(
			function () {
				highlightOutput(cslId);
			},
			function () {
				unHighlightNode(cslId);
			}
		);
	};

	var doSyntaxHighlighting = function () {
		var numCslNodes = CSLEDIT.data.numCslNodes();
			
		console.time("syntaxHighlighting");
		// clear the hovered node stack
		hoveredNodeStack.length = 0;
		selectedCslId = -1;

		// syntax highlighting
		for (var index = 0; index < numCslNodes; index++) {
			setupSyntaxHighlightForNode(index);
		}
		console.timeEnd("syntaxHighlighting");
	};

	var createTreeView = function () {
		var nodeIndex = { index : 0 };
		var cslData = CSLEDIT.data.get(); 

		cslTreeView.createFromCslData(cslData,
		{
			loaded : function (event, data) {
				console.log("tree loaded");

				var cslData = CSLEDIT.data.get();

				CSLEDIT.citationEngine.runCiteprocAndDisplayOutput(
					$("#statusMessage"), $("#exampleOutput"),
					$("#formattedCitations"), $("#formattedBibliography"),
					doSyntaxHighlighting,
					CSLEDIT.data.getFirstCslId(cslData, "citation"),
					CSLEDIT.data.getFirstCslId(cslData, "bibliography"));
			},
			selectNode : nodeSelected,
			deleteNode : function () {
				controller.exec("deleteNode", [cslTreeView.selectedNode()]);
			}
		});
	};
/*
	var treeViewChanged = function () {
		jsonData = treeEditor.jstree("get_json", -1, [], [])[0];
		updateCslIds();
		formatExampleCitations();
	};
*/
	var formatExampleCitations = function () {
		// TODO: remove, no longer reading data from the view
		//CSLEDIT.code.set(CSLEDIT.cslParser.cslXmlFromJson([jsonData]));

		var cslData = CSLEDIT.data.get();

		CSLEDIT.citationEngine.runCiteprocAndDisplayOutput(
			$("#statusMessage"), $("#exampleOutput"),
			$("#formattedCitations"), $("#formattedBibliography"),
			doSyntaxHighlighting,
			CSLEDIT.data.getFirstCslId(cslData, "citation"),
			CSLEDIT.data.getFirstCslId(cslData, "bibliography"));
	};

	var nodeSelected = function(event, ui) {
		var nodeAndParent,
			node,
			parentNode,
			propertyPanel = $("#elementProperties"),
			possibleElements,
			element,
			possibleChildNodesDropdown,
			schemaAttributes,
			schemaAttribute,
			valueIndex,
			schemaValues,
			parentNode,
			parentJsonData,
			parentNodeName,
			dataType;

		nodeAndParent = CSLEDIT.data.getNodeAndParent(cslTreeView.selectedNode());
		node = nodeAndParent.node;
		parentNode = nodeAndParent.parent;

		console.log("selected node : " + node.name);
		console.log("parent node : " + parent.name);

		// hack to stop parent of style being style
		if (node.name === "style") {
			parentNodeName = "root";
		} else if (parentNode !== false) {
			console.time("get parent");
			parentNodeName = parentNode.name;
			console.timeEnd("get parent");
		} else {
			parentNodeName = "root";
		}

		// update possible child elements based on schema
		if (typeof CSLEDIT.schema !== "undefined") {
			possibleElements = CSLEDIT.schema.childElements(parentNodeName + "/" + node.name);

			possibleChildNodesDropdown = $("#possibleChildNodes").html("");

			for (element in possibleElements) {
				$('<li><a href="#">' + element + '</a></li>').appendTo(possibleChildNodesDropdown);
			}
		}

		// reregister dropdown handler after changes
		setupDropdownMenuHandler("#possibleChildNodes a");

		dataType = CSLEDIT.schema.elementDataType(parentNodeName + "/" + node.name);
		schemaAttributes = CSLEDIT.schema.attributes(parentNodeName + "/" + node.name);

		CSLEDIT.propertyPanel.setupPanel(
			$("#elementProperties"), node, dataType, schemaAttributes, nodeChanged);

		$('span[cslid="' + oldSelectedNode + '"]').css(unHighlightedCss);
		oldSelectedNode = node.cslId;

		$('span[cslid="' + node.cslId + '"]').css(selectedCss);
	};

	var nodeChanged = function (node) {
		var selectedNodeId = cslTreeView.selectedNode(),
			attributes = [];

		//node = CSLEDIT.data.getNode(selectedNodeId);

		// TODO: assert check that persistent data wasn't changed in another tab, making
		//       this form data possibly refer to a different node

		// read user data
		var numAttributes = $('[id^="nodeAttributeLabel"]').length,
			index,
			key, value;

		console.time("readingUserInput");
		for (index = 0; index < numAttributes; index++) {
			key = $("#nodeAttributeLabel" + index).html();
			value = $("#nodeAttribute" + index).val();
			attributes.push({
				key : key,
				value : value,
				enabled : node.attributes[index].enabled
			});
		}
		console.timeEnd("readingUserInput");
		node.attributes = attributes;

		controller.exec("ammendNode", [selectedNodeId, node]);
		//treeEditor.jstree("rename_node", selectedNode,
		//	CSLEDIT.cslParser.displayNameFromMetadata(metadata));
		//formatExampleCitations();
	};
/*
	var updateCslIds = function () {
		CSLEDIT.cslParser.updateCslIds(jsonData, {index:0});

		// update the html attributes to be in sync
		treeEditor.find("[cslid]").each(function (index) {
			var metadata = $(this).data();
			$(this).attr("cslid", metadata.cslId);
		});
	};
*/
	var reloadPageWithNewStyle = function (newURL) {
		var reloadURL = window.location.href;
		reloadURL = reloadURL.replace(/#/, "");
		reloadURL = reloadURL.replace(/\?.*$/, "");
		window.location.href = reloadURL + "?styleURL=" + newURL;
	};

	var updateCslData = function (cslCode) {
		// strip comments from style
		data = data.replace(/<!--.*?-->/g, "");

		CSLEDIT.data.setCslCode(cslCode);
		createTreeView();
	};

	var setupDropdownMenuHandler = function (selector) {
		$(selector).click(function (event) {
			var clickedName = $(event.target).text(),
				selectedNodeId = $('#treeEditor').jstree('get_selected'),
				parentNode = $(event.target).parent().parent(),
				parentNodeName,
				position;

			if (parentNode.attr("class") === "sub_menu")
			{
				parentNodeName = parentNode.siblings('a').text();

				if (/^Edit/.test(parentNodeName)) {
					if (clickedName === "Delete node") {
						controller.exec("deleteNode", [cslTreeView.selectedNode()]);
					}
				} else if ((/^Add node/).test(parentNodeName)) {
					$(event.target).parent().parent().css('visibility', 'hidden');

					controller.exec("addNode", [
						cslTreeView.selectedNode(), 0, { name : clickedName, attributes : []}
					]);
				} else if ((/^Style/).test(parentNodeName)) {
					if (clickedName === "Revert (undo all changes)") {
						reloadPageWithNewStyle(styleURL);
					} else if (clickedName === "Export CSL") {
						window.location.href =
							"data:application/xml;charset=utf-8," +
							encodeURIComponent(CSLEDIT.data.getCslCode());
					} else if (clickedName === "Load from URL") {
						reloadPageWithNewStyle(
							prompt("Please enter the URL of the style you wish to load")
						);
					} else if (clickedName === "New style") {
						reloadPageWithNewStyle(
							window.location.protocol + "//" + window.location.hostname + "/csl/content/newStyle.csl");
					}
				}
			}
		});
	};

	return {
		init : function () {
			$("#dialog-confirm-delete").dialog({autoOpen : false});

			$(function(){
				$("ul.dropdown li").hover(function(){
				
					$(this).addClass("hover");
					$('ul:first',this).css('visibility', 'visible');
				
				}, function(){
				
					$(this).removeClass("hover");
					$('ul:first',this).css('visibility', 'hidden');
				
				});
				
				$("ul.dropdown li ul li:has(ul)").find("a:first").append(" &raquo; ");
			});

			CSLEDIT.data.initPageStyle( function () {
				cslTreeView = CSLEDIT.CslTreeView($("#treeEditor"))
				controller = CSLEDIT.Controller();

				controller.addSubscriber("addNode", CSLEDIT.data.addNode);
				controller.addSubscriber("deleteNode", CSLEDIT.data.deleteNode);
				controller.addSubscriber("ammendNode", CSLEDIT.data.ammendNode);
				controller.addSubscriber("setCslCode", CSLEDIT.data.setCslCode);	
				
				controller.addSubscriber("addNode", cslTreeView.addNode);
				controller.addSubscriber("deleteNode", cslTreeView.deleteNode);
				controller.addSubscriber("ammendNode", cslTreeView.ammendNode);
				controller.addSubscriber("setCslCode", cslTreeView.setCslCode);

				CSLEDIT.data.onChanged(formatExampleCitations);

				createTreeView();
			});

			setupDropdownMenuHandler(".dropdown a");

			$(".propertyInput").on("change", nodeChanged);

			setSizes();
			$(window).resize(setSizes);
		}
	};
}());

$("document").ready( function () {
	CSLEDIT.schema.callWhenReady( CSLEDIT.editorPage.init );
});
