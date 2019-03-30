function SankeyBranch(data, correctInput, inputEl, resultsEl, svgEl) {
    var longestEntry, segmentedNodes, links, plainNodes, sankey, userInput, svg;
    var nodeWidth = 70;
    var avgNodeHeight = 60;

    this.init = function() {
        longestEntry = data.reduce(returnLongestName, { name: '' }).name;

        segmentedNodes = getSegmentedNodes(data);
        links = getLinks(segmentedNodes);
        plainNodes = getPlainNodes(segmentedNodes);

        userInput = correctInput[0];
        inputEl.value = userInput;
        inputEl.setAttribute('maxlength', longestEntry.length);
        inputEl.addEventListener('input', onInput);
        resultsEl.addEventListener('click', onResultsClick);

        var width = segmentedNodes.length * nodeWidth;
        var height = segmentedNodes.reduce((currH, segment) => segment.length > currH ? segment.length : currH, 0) * avgNodeHeight;

        svg = d3.select(svgEl)
            .attr('width', width)
            .attr('height', height)
            .append('g');

        sankey = d3.sankey()
            .nodeWidth(nodeWidth)
            .nodePadding(16)
            .nodeAlign(d3.sankeyLeft)
            .nodeId(d => d.id)
            .size([width, height])
            .iterations(1);

        processDataAndRenderChart();
    }

    function sortByName(nameA, nameB) {
        if (nameA.name > nameB.name) {
            return 1;
        }
        if (nameA.name < nameB.name) {
            return -1;
        }
        return 0;
    }

    function returnLongestName(nameA, nameB) {
        if (!nameA) {
            return nameB;
        }
        if (nameA.name.length > nameB.name.length) {
            return nameA;
        }
        return nameB;
    }

    function sumNameCount(prevSum, name) {
        return prevSum + name.count;
    }

    function sumAndNormalizeNameCount(prevSum, name) {
        return prevSum + Math.pow(Math.log(name.count), 3);
    }

    function getSegmentedNodes(data) {
        data.sort(sortByName);
        var segmentedNodes = [];
        for (var i = 0; i < longestEntry.length; i++) {
            var lastChar = '';
            for (let n = 0; n < data.length; n++) {
                var name = data[n].name;
                if (name.length <= i) {
                    continue;
                }

                var char = name[i];
                if (char === lastChar) {
                    continue;
                }

                if (!segmentedNodes[i]) {
                    segmentedNodes.push([]);
                }

                var id = name.substring(0, i + 1);
                if (segmentedNodes[i].find(function(n) {
                        return n.id === id;
                    })) {
                    continue;
                }

                var count = data.filter(function(n) {
                        return n.name.startsWith(id);
                    })
                    .reduce(sumNameCount, 0);

                var normalizedCount = data.filter(function(n) {
                        return n.name.startsWith(id);
                    })
                    .reduce(sumAndNormalizeNameCount, 0);
                segmentedNodes[i].push({
                    id: id,
                    name: char,
                    count: normalizedCount,
                    actualCount: count
                });
            }
        }

        return segmentedNodes;
    }

    function getLinks(segmentedNodes) {
        var links = [];
        for (var i = 0; i < segmentedNodes.length; i++) {
            if (i + 1 === segmentedNodes.length) {
                break;
            }

            for (let j = 0; j < segmentedNodes[i].length; j++) {
                const currNode = segmentedNodes[i][j];
                for (let n = 0; n < segmentedNodes[i + 1].length; n++) {
                    const nextSegmentNode = segmentedNodes[i + 1][n];
                    if (nextSegmentNode.id.startsWith(currNode.id)) {
                        links.push({
                            source: currNode.id,
                            target: nextSegmentNode.id,
                            value: nextSegmentNode.count,
                            actualCount: nextSegmentNode.actualCount
                        });
                    }
                }
            }
        }

        return links;
    }

    function getPlainNodes(segmentedNodes) {
        return Array.prototype.concat.apply([], segmentedNodes);
    }

    function getNodePath(d) {
        var x0 = d.x0;
        var y0 = d.y0;
        var x1 = d.x1;
        var y1 = d.y0;
        var x2 = d.x1;
        var y2 = d.y1;
        var x3 = d.x0;
        var y3 = d.y1;

        if (d.targetLinks.length > 0) {
            var baseY = 0;
            for (var i = 0; i < d.targetLinks[0].source.sourceLinks.length; i++) {
                var node = d.targetLinks[0].source.sourceLinks[i].target;
                if (node === d) {
                    break;
                }

                baseY += node.y1 - node.y0;
            }

            var currentHeight = d.y1 - d.y0;
            if (d.targetLinks[0].source.sourceLinks.length === 1) {
                currentHeight = d.targetLinks[0].source.y1 - d.targetLinks[0].source.y0;
            }

            x0 = d.targetLinks[0].source.x1;
            y0 = d.targetLinks[0].source.y0 + baseY;
            x3 = d.targetLinks[0].source.x1;
            y3 = d.targetLinks[0].source.y0 + currentHeight + baseY;
        }

        d.leftSideX1 = x0;
        d.leftSideY1 = y0;
        d.leftSideX2 = x3;
        d.leftSideY2 = y3;
        d.leftSideHeight = y3 - y0;

        return 'M' + x0 + ',' + y0 +
            'L' + x1 + ',' + y1 +
            'L' + x2 + ',' + y2 +
            'L' + x3 + ',' + y3 +
            'L' + x0 + ',' + y0;
    }

    function processDataAndRenderChart(showResults) {
        var existingNode = plainNodes.find(n => n.id === userInput);
        if (!existingNode) {
            var minCount = data.reduce((currMin, n) => n.count < currMin ? n.count : currMin, Number.MAX_SAFE_INTEGER);
            var dataCopy = Object.assign([], data);
            var paddedInput = userInput;
            if (userInput.length < longestEntry.length) {
                paddedInput += String.fromCharCode(0).repeat(longestEntry.length - userInput.length);
            }
            dataCopy.push({
                name: paddedInput,
                count: minCount
            });

            var newSegmentedNodes = getSegmentedNodes(dataCopy);
            var newLinks = getLinks(newSegmentedNodes);
            var newPlainNodes = getPlainNodes(newSegmentedNodes);

            renderChart({ nodes: newPlainNodes, links: newLinks }, userInput, showResults);
            return;
        }

        renderChart({ nodes: plainNodes, links: links }, userInput, showResults);
    }

    function renderChart(graph, userInput, showResults) {

        const { nodes, links } = sankey(graph);

        svg.attr('class', function() {
            return showResults ? 'show-results' : '';
        });

        svg.selectAll('.node')
            .data(nodes)
            .join('path')
            .attr('d', d => getNodePath(d))
            .attr('class', d => {
                var nodeClass = 'node';
                if (d.name === String.fromCharCode(0)) {
                    nodeClass += ' is-padding';
                    return nodeClass;
                }
                if (d.depth <= userInput.length - 1) {
                    nodeClass += ' is-visible';
                }
                if (userInput.startsWith(d.id)) {
                    nodeClass += ' user-input'
                }
                if (showResults && correctInput.startsWith(d.id)) {
                    nodeClass += ' is-correct';
                }

                return nodeClass;
            })
            .append('title')
            .text(d => d.id + '\n' + d.actualCount);

        svg.selectAll('.node-left-border')
            .data(nodes)
            .join('line')
            .attr('class', d => {
                var borderClass = 'node-left-border';
                if (d.name === String.fromCharCode(0)) {
                    borderClass += ' is-padding';
                    return borderClass;
                }
                if (d.depth <= userInput.length - 1) {
                    borderClass += ' is-visible';
                }
                if (userInput.startsWith(d.id)) {
                    borderClass += ' user-input';
                }
                if (showResults && correctInput.startsWith(d.id)) {
                    borderClass += ' is-correct';
                }

                return borderClass;
            })
            .attr('x1', d => d.leftSideX1)
            .attr('y1', d => d.leftSideY1)
            .attr('x2', d => d.leftSideX2)
            .attr('y2', d => d.leftSideY2);

        svg.selectAll('.node-text')
            .data(nodes)
            .join('text')
            .attr('font-size', d => {
                var fontSize = Math.max(Math.min((d.y1 - d.y0) * 0.5, (d.x1 - d.x0) * 0.8), 12);
                d.nodeTextFontSize = fontSize;
                return fontSize;
            })
            .attr('x', d => (d.x0 + d.x1) / 2)
            .attr('y', d => (((d.leftSideY1 + d.leftSideY2) / 2) + ((d.y0 + d.y1) / 2)) / 2)
            .attr('dy', '0.35em')
            .attr('class', d => {
                var textClass = 'node-text';
                if (d.name === String.fromCharCode(0)) {
                    textClass += ' is-padding';
                    return textClass;
                }
                if (userInput.startsWith(d.id)) {
                    textClass += ' user-input';
                }
                if (showResults && correctInput.startsWith(d.id)) {
                    textClass += ' is-correct';
                }

                return textClass;
            })
            .text(d => d.name);

        svg.selectAll('.node-text-count')
            .data(nodes)
            .join('text')
            .attr('x', d => (d.x0 + d.x1) / 2)
            .attr('y', d => (((d.leftSideY1 + d.leftSideY2) / 2) + ((d.y0 + d.y1) / 2)) / 2)
            .attr('dy', d => (d.nodeTextFontSize * 0.6) + 8)
            .attr('class', d => {
                var textCountClass = 'node-text-count';
                if (!showResults) {
                    return textCountClass;
                }
                if (d.name === String.fromCharCode(0)) {
                    textCountClass += ' is-padding';
                    return textCountClass;
                }
                if (d.nodeTextFontSize + 12 + 8 < d.y1 - d.y0) {
                    textCountClass += ' is-visible';
                }
                if (showResults && correctInput.startsWith(d.id)) {
                    textCountClass += ' is-correct';
                }

                return textCountClass;
            })
            .text(d => '' + (d.actualCount > 999 ? (d.actualCount / 1000).toFixed(1) + 'k' : d.actualCount.toFixed(0)) + '');
    };

    function onInput(e) {
        var input = e.target.value;
        if (input.length === 0 || !input.startsWith(correctInput[0])) {
            e.target.value = correctInput[0];
            return;
        }

        userInput = input;
        processDataAndRenderChart();
    }

    function onResultsClick() {
        processDataAndRenderChart(true);
    }
}
